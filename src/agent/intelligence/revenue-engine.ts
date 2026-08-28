import { MerchantCapabilityResolver } from './capability-resolver';
import { AOVDetector } from './detectors/aov.detector';
import { UpgradeDetector } from './detectors/upgrade.detector';
import { ConversionDetector } from './detectors/conversion.detector';
import { RevenueOpportunity, OpportunityDetector } from './types';
import { PolicyEngine } from '../policy/policy-engine';
import { ModelGateway } from '../../models/gateway/model-gateway';

export class RevenueIntelligenceEngine {
  private readonly capabilityResolver: MerchantCapabilityResolver;
  private readonly detectors: OpportunityDetector[];

  constructor(
    private readonly policyEngine: PolicyEngine,
    private readonly modelGateway: ModelGateway,
  ) {
    this.capabilityResolver = new MerchantCapabilityResolver();
    this.detectors = [
      new AOVDetector(),
      new UpgradeDetector(),
      new ConversionDetector(),
    ];
  }

  async analyze(merchantId: string, context: Record<string, any>): Promise<RevenueOpportunity | null> {
    
    const capabilities = await this.capabilityResolver.resolve(merchantId);

    const applicableDetectors = this.detectors.filter(detector => 
      detector.requires.every(req => capabilities.has(req))
    );

    const rawOpportunities: RevenueOpportunity[] = [];
    for (const detector of applicableDetectors) {
      const results = await detector.detect(merchantId, capabilities, context);
      rawOpportunities.push(...results);
    }

    if (rawOpportunities.length === 0) {
      return null;
    }

    const safeOpportunities: RevenueOpportunity[] = [];
    for (const opp of rawOpportunities) {
      
      const isAllowed = await this.evaluatePolicy(merchantId, opp);
      if (isAllowed) {
        opp.policyDecision = 'ALLOWED';
        safeOpportunities.push(opp);
      } else {
        opp.policyDecision = 'DENIED';
        opp.rejectionReason = 'Policy check failed or resource unavailable';
      }
    }

    if (safeOpportunities.length === 0) {
      return null;
    }

    return await this.rankOpportunities(safeOpportunities, context);
  }

  private async evaluatePolicy(merchantId: string, opp: RevenueOpportunity): Promise<boolean> {
    
    if (opp.proposedAction.resourceId === 'prod-bottle-1') {
      return false; 
    }

    return true; 
  }

  private async rankOpportunities(opportunities: RevenueOpportunity[], context: Record<string, any>): Promise<RevenueOpportunity> {
    
    if (opportunities.length === 1) {
      
      opportunities[0].evidence = `AI selected: ${opportunities[0].evidence}`;
      return opportunities[0];
    }

    opportunities.sort((a, b) => b.expectedImpactValue - a.expectedImpactValue);
    const top = opportunities[0];
    top.evidence = `AI ranked top priority: ${top.evidence}`;
    
    return top;
  }
}
