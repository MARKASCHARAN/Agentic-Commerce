export type RevenueOpportunityType =
  | 'UPSELL'
  | 'CROSS_SELL'
  | 'BUNDLE'
  | 'UPGRADE'
  | 'BULK_QUOTE'
  | 'RECOVERY'
  | 'REPEAT_PURCHASE';

export type PolicyDecision =
  | 'ALLOWED'
  | 'DENIED';

export type ProposedActionType = 
  | 'ADD_PRODUCT'
  | 'UPGRADE_PLAN'
  | 'APPLY_DISCOUNT'
  | 'RETRY_PAYMENT'
  | 'RESUME_CHECKOUT';

export interface ProposedAction {
  actionType: ProposedActionType;
  resourceId?: string; 
  quantity?: number;
  priceMinor?: number; 
  discountMinor?: number;
}

export interface RevenueOpportunity {
  id: string;
  merchantId: string;
  sessionId?: string;
  buyerId?: string;
  type: RevenueOpportunityType;
  affectedResources: string[]; 
  expectedImpactValue: number; 
  confidence: number;          
  evidence: string;            
  proposedAction: ProposedAction;
  policyDecision?: PolicyDecision;
  rejectionReason?: string;
}

export type MerchantCapability = 
  | 'catalog'
  | 'inventory'
  | 'pricing'
  | 'subscriptions'
  | 'usage'
  | 'negotiation'
  | 'catalog.read'
  | 'inventory.read'
  | 'quote.create'
  | 'offer.create'
  | 'negotiation.create'
  | 'order.create'
  | 'payment.create'
  | 'refund.create';

export interface MerchantCapabilities {
  has(capability: MerchantCapability): boolean;
  getAll(): MerchantCapability[];
}

export interface OpportunityDetector {
  readonly requires: MerchantCapability[];
  detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]>;
}
