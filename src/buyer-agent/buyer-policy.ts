export interface BuyerPolicy {
  budgetMinor: number;
  quantity: number;
  requiredAttributes: Record<string, string>;
  allowCrossSell: boolean;
  allowUpsell: boolean;
  maxCounterAttempts: number;
  acceptableMaxMinor: number; // The absolute maximum they will pay after a counter offer
}

export type EvaluationResult = 
  | { action: 'ACCEPT' }
  | { action: 'COUNTER'; targetTotalMinor: number; reason: string }
  | { action: 'REJECT'; reason: string };

export function evaluateOffer(offer: any, policy: BuyerPolicy, attemptCount: number): EvaluationResult {
  console.log(`\n🔍 Evaluating Offer (Attempt ${attemptCount}/${policy.maxCounterAttempts})...`);
  console.log(`   - Offer Total: ₹${offer.totalMinor / 100}`);
  console.log(`   - Target Budget: ₹${policy.budgetMinor / 100}`);

  // 1. Check if the offer contains the primary required item
  // (In a real deterministic scenario, we'd check the exact SKU or attributes. 
  // For the demo, we assume the first item is the primary item).
  if (!offer.items || offer.items.length === 0) {
    return { action: 'REJECT', reason: 'Offer is empty.' };
  }

  // 2. Check for unwanted cross-sells
  if (!policy.allowCrossSell && offer.items.length > 1) {
    return { action: 'REJECT', reason: 'Unwanted cross-sell items included in the offer.' };
  }

  // 3. Evaluate Price
  if (offer.totalMinor <= policy.budgetMinor) {
    return { action: 'ACCEPT' };
  }

  // 4. Offer is over budget, should we counter?
  if (attemptCount < policy.maxCounterAttempts) {
    // If it's within the acceptable maximum, we counter with our strict budget
    if (offer.totalMinor <= policy.acceptableMaxMinor) {
      console.log(`   - Offer is slightly over budget. Formulating counter-offer for ₹${policy.budgetMinor / 100}...`);
      return { action: 'COUNTER', targetTotalMinor: policy.budgetMinor, reason: 'Offer exceeds budget.' };
    } else {
      return { action: 'REJECT', reason: 'Offer price is unacceptably high and beyond negotiation bounds.' };
    }
  }

  return { action: 'REJECT', reason: 'Max negotiation attempts reached.' };
}
