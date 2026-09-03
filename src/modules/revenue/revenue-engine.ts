import { MerchantCapabilityResolver } from './capability-resolver.js';
import { MerchantGuardrailConfig } from '../policy/guardrails.js';
import { AOVDetector } from './detectors/aov.detector.js';
import { UpgradeDetector } from './detectors/upgrade.detector.js';
import { ConversionDetector } from './detectors/conversion.detector.js';
import { ConversionOptimizationDetector } from './detectors/conversion-optimization.detector.js';
import { RevenueRecoveryDetector } from './detectors/revenue-recovery.detector.js';
import { RepeatPurchaseDetector } from './detectors/repeat-purchase.detector.js';
import { getSessionExperimentGroup } from './experiment.js';
import { MerchantStrategy, MerchantStrategyResolver } from './merchant-strategy.js';
import { RevenueOpportunity, OpportunityDetector } from './types.js';
import { ModelGateway } from '../../infrastructure/ai/model-gateway.js';
import { PrismaClient } from '@prisma/client';
import { PrismaCatalogProvider } from '../catalog/prisma-catalog.provider.js';

export class RevenueIntelligenceEngine {
  private readonly capabilityResolver: MerchantCapabilityResolver;
  private readonly detectors: OpportunityDetector[];
  private readonly strategyResolver?: MerchantStrategyResolver;

  constructor(
    private readonly modelGateway: ModelGateway,
    capabilityResolver?: MerchantCapabilityResolver,
    private readonly prisma?: PrismaClient
  ) {
    this.capabilityResolver = capabilityResolver || new MerchantCapabilityResolver();
    this.strategyResolver = prisma ? new MerchantStrategyResolver(prisma) : undefined;
    // When prisma is absent, use an empty catalog provider — never substitute demo products.
    const catalogProvider = prisma
      ? new PrismaCatalogProvider(prisma)
      : {
          search: async () => [],
          get: async () => null,
          getRelatedProducts: async () => [],
        };

    this.detectors = [
      new AOVDetector(catalogProvider as any),
      new UpgradeDetector(prisma),
      new ConversionDetector(prisma),
      new ConversionOptimizationDetector(prisma),
      new RevenueRecoveryDetector(prisma),
      new RepeatPurchaseDetector(prisma),
    ];
  }

  async analyze(merchantId: string, context: Record<string, any>, guardrails?: MerchantGuardrailConfig): Promise<RevenueOpportunity | null> {
    const sessionId = context.sessionId;
    if (context.experimentEnabled && sessionId && getSessionExperimentGroup(sessionId) === 'CONTROL') {
      return null;
    }

    const capabilities = await this.capabilityResolver.resolve(merchantId);

    const applicableDetectors = this.detectors.filter(detector =>
      detector.requires.every(req => capabilities.has(req))
    );

    const rawOpportunities: RevenueOpportunity[] = [];
    for (const detector of applicableDetectors) {
      const results = await detector.detect(merchantId, capabilities, context);
      console.log(`[DEBUG REVENUE] Detector ${detector.constructor.name} returned:`, results.length);
      rawOpportunities.push(...results);
    }
    console.log('[DEBUG REVENUE] rawOpportunities:', rawOpportunities.length);

    if (guardrails) {
      if (!guardrails.upsellEnabled) {
        // Remove UPSELL
        for (let i = rawOpportunities.length - 1; i >= 0; i--) {
          if (rawOpportunities[i].type === 'UPSELL') rawOpportunities.splice(i, 1);
        }
      }
      if (!guardrails.crossSellEnabled) {
        // Remove CROSS_SELL
        for (let i = rawOpportunities.length - 1; i >= 0; i--) {
          if (rawOpportunities[i].type === 'CROSS_SELL') rawOpportunities.splice(i, 1);
        }
      }
    }

    if (rawOpportunities.length === 0) {
      console.log('[DEBUG REVENUE] No raw opportunities after guardrails.');
      return null;
    }

    const safeOpportunities: RevenueOpportunity[] = [];
    for (const opp of rawOpportunities) {
      // 1. Check database logs for decided opportunities in this session
      if (this.prisma && opp.sessionId) {
        const decidedOppLog = await this.prisma.revenueOpportunityLog.findFirst({
          where: {
            sessionId: opp.sessionId,
            opportunityType: opp.type,
            status: { in: ['ACCEPTED', 'REJECTED', 'CONVERTED'] }
          }
        });
        if (decidedOppLog) {
          continue; // Skip already decided opportunity log
        }

        // 2. Check the Cart model's accepted/rejected lists
        const cart = await this.prisma.cart.findUnique({
          where: { sessionId: opp.sessionId }
        });
        if (cart) {
          const resourceId = opp.proposedAction?.resourceId;
          const isDecided = (resourceId && (
            cart.rejectedOpportunities.includes(resourceId) ||
            cart.acceptedOpportunities.includes(resourceId)
          )) || cart.rejectedOpportunities.includes(opp.id) || cart.acceptedOpportunities.includes(opp.id);

          if (isDecided) {
            continue; // Skip if resource or opportunity ID is in cart's decided lists
          }
        }
      }

      const isAllowed = await this.evaluatePolicy(merchantId, opp, guardrails);
      if (isAllowed) {
        // Check approval threshold: mark as REVIEW if above limit
        if (guardrails && guardrails.approvalAboveMinor > 0 && opp.proposedAction?.priceMinor) {
          if (opp.proposedAction.priceMinor > guardrails.approvalAboveMinor) {
            opp.policyDecision = 'REVIEW';
          } else {
            opp.policyDecision = 'ALLOWED';
          }
        } else {
          opp.policyDecision = 'ALLOWED';
        }
        safeOpportunities.push(opp);
      } else {
        opp.policyDecision = 'DENIED';
        opp.rejectionReason = 'Policy check failed or resource unavailable';
      }
    }

    if (safeOpportunities.length === 0) {
      return null;
    }

    const strategy = this.strategyResolver ? await this.strategyResolver.resolve(merchantId) : undefined;
    console.log('[DEBUG REVENUE] safeOpportunities:', safeOpportunities.length);

    return await this.rankOpportunities(safeOpportunities, context, guardrails, strategy);
  }

  private async evaluatePolicy(merchantId: string, opp: RevenueOpportunity, guardrails?: MerchantGuardrailConfig): Promise<boolean> {
    const resourceId = opp.proposedAction?.resourceId;
    if (!resourceId) {
      return false;
    }

    if (this.prisma) {
      const product = await this.prisma.product.findUnique({
        where: { id: resourceId }
      });
      if (!product || !product.active || product.merchantId !== merchantId) {
        return false;
      }

      // Discount ceiling enforcement
      if (guardrails && guardrails.maxDiscountBps > 0 && opp.proposedAction?.discountMinor && product.priceMinor > 0) {
        const maxDiscountMinor = Math.floor((product.priceMinor * guardrails.maxDiscountBps) / 10000);
        if (opp.proposedAction.discountMinor > maxDiscountMinor) {
          return false;
        }
      }

      // Margin floor enforcement
      if (guardrails && guardrails.minimumMarginBps > 0 && opp.proposedAction?.priceMinor && product.priceMinor > 0) {
        const minimumPriceMinor = Math.ceil(product.priceMinor * (10000 - guardrails.minimumMarginBps) / 10000);
        if (opp.proposedAction.priceMinor < minimumPriceMinor) {
          return false;
        }
      }
    }

    return true; 
  }

  private async rankOpportunities(opportunities: RevenueOpportunity[], context: Record<string, any>, guardrails?: MerchantGuardrailConfig, strategy?: MerchantStrategy): Promise<RevenueOpportunity | null> {
    
    // Filter by buyer budget if provided in context
    if (context.buyerBudgetMinor && context.basePriceMinor) {
      opportunities = opportunities.filter(opp => {
        const addedPrice = opp.proposedAction?.priceMinor || 0;
        return (context.basePriceMinor + addedPrice) <= context.buyerBudgetMinor;
      });
    }

    if (opportunities.length === 0) {
      return null;
    }

    if (opportunities.length === 1) {
      opportunities[0].evidence = `AI selected: ${opportunities[0].evidence}`;
      return opportunities[0];
    }

    // Apply strategy boosts before sorting
    if (strategy) {
      for (const opp of opportunities) {
        const resourceId = opp.proposedAction?.resourceId;
        if (resourceId) {
          if (strategy.preferredProductIds.includes(resourceId)) {
            opp.confidence = Math.min(opp.confidence * 1.5, 1.0);
          }
          if (strategy.highMarginProductIds.includes(resourceId)) {
            opp.expectedImpactValue = Math.round(opp.expectedImpactValue * 1.3);
          }
        }
      }
    }

    const goal = strategy?.primaryGoal || guardrails?.revenueGoal || 'BALANCED';

    if (goal === 'INCREASE_CONVERSION') {
      opportunities.sort((a, b) => b.confidence - a.confidence);
    } else if (goal === 'PROMOTE_PREFERRED' && strategy) {
      // Preferred products always rank first
      opportunities.sort((a, b) => {
        const aPreferred = strategy.preferredProductIds.includes(a.proposedAction?.resourceId || '') ? 1 : 0;
        const bPreferred = strategy.preferredProductIds.includes(b.proposedAction?.resourceId || '') ? 1 : 0;
        if (bPreferred !== aPreferred) return bPreferred - aPreferred;
        return b.expectedImpactValue - a.expectedImpactValue;
      });
    } else {
      // BALANCED, INCREASE_AOV, or default
      opportunities.sort((a, b) => b.expectedImpactValue - a.expectedImpactValue);
    }

    const top = opportunities[0];
    top.evidence = `AI ranked top priority based on ${goal} goal: ${top.evidence}`;

    return top;
  }
}
