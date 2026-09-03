import { PrismaClient, Product } from '@prisma/client';
import { CommerceContext } from './commerce-context.js';
import { RevenueIntelligenceEngine } from '../revenue/revenue-engine.js';
import { MerchantCapabilityResolver } from '../revenue/capability-resolver.js';
import { Opportunity } from './commerce-context.js'; // Assuming we map to this or use RevenueOpportunity

export class CapacityLimitExceededError extends Error {
  constructor(public message: string, public opportunities: any[]) {
    super(message);
    this.name = 'CapacityLimitExceededError';
  }
}

export class CommerceService {
  private revenueEngine: RevenueIntelligenceEngine;

  constructor(private prisma: PrismaClient) {
    this.revenueEngine = new RevenueIntelligenceEngine(
      {} as any, // ModelGateway not needed for purely deterministic opportunity retrieval
      new MerchantCapabilityResolver(),
      prisma
    );
  }

  async validateRequest(context: CommerceContext, products: Product[]): Promise<void> {
    const productMap = new Map<string, Product>();
    for (const p of products) {
      productMap.set(p.id, p);
    }

    let hasViolation = false;
    let fallbackOpportunities: any[] = [];

    // Check physical inventory and SaaS limits
    for (const item of context.cart?.items || []) {
      const product = productMap.get(item.productId);
      if (!product) continue;

      if (product.type === 'PHYSICAL') {
        const inventory = await this.prisma.inventory.findUnique({ where: { productId: product.id } });
        if ((inventory?.quantity || 0) < item.quantity) {
          throw new Error(`INVENTORY_UNAVAILABLE: Insufficient inventory for product ${product.id}`);
        }
      }

      if (product.type === 'SAAS_PLAN') {
        // Evaluate constraints from domain metadata
        const maxSeats = (product.metadata as any)?.maxSeats;
        const requestedSeats = item.attributes?.requestedSeats as number;
        
        if (maxSeats !== undefined && requestedSeats && requestedSeats > maxSeats) {
          hasViolation = true;
        }
      }
    }

    if (hasViolation) {
      // Pass execution to RevenueEngine to see if an opportunity exists to recover/upgrade this violation
      const guardrails = await this.prisma.merchantGuardrail.findUnique({
        where: { merchantId: context.merchantId }
      });

      // We inject the generic attributes directly into the context object evaluated by RevenueEngine
      const rawContext = {
        sessionId: context.sessionId,
        currentPlanId: context.cart?.items[0]?.productId,
        requestedSeats: context.cart?.items[0]?.attributes?.requestedSeats
      };

      const opportunities = await this.revenueEngine.analyze(
        context.merchantId,
        rawContext,
        guardrails || undefined
      );

      // Analyze returns a single Opportunity in the current implementation, or null
      if (opportunities) {
        fallbackOpportunities.push(opportunities);
      }

      throw new CapacityLimitExceededError(
        "The requested quantity or attributes exceed the limits of the selected plan. A required upgrade opportunity was generated.",
        fallbackOpportunities
      );
    }
  }
}
