export type CommerceIntent =
  | "PURCHASE"
  | "UPGRADE"
  | "RENEW"
  | "EXPAND"
  | "BOOK"
  | "RECOVER"
  | "CROSS_SELL";

export interface CartContext {
  items: Array<{
    productId: string;
    quantity: number;
    unitPriceMinor: number;
    attributes?: Record<string, string | number | boolean>;
  }>;
  subtotalMinor: number;
}

export interface SubscriptionContext {
  planId: string;
  seats: number;
  billingCycle: 'MONTHLY' | 'ANNUALLY';
}

export interface CommerceContext {
  merchantId: string;
  buyerId: string;
  sessionId: string;

  intent: CommerceIntent;

  cart?: CartContext;
  subscription?: SubscriptionContext;
  // booking?: BookingContext; // For future travel/services

  capabilities: string[];
}

export interface Opportunity {
  id: string;
  type: 'UPSELL' | 'CROSS_SELL' | 'UPGRADE' | 'RETENTION';
  trigger: string;
  sourceId?: string;
  targetId: string;
  expectedRevenueMinor: number;
  reason: string;
  confidence: number;
}
