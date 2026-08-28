import { NegotiationPolicy, NegotiationProposal, NegotiationResult } from './types';
import { MerchantGuardrailConfig } from '../../policy/guardrails';

export class NegotiationEngine {
  evaluate(proposal: NegotiationProposal, policy: NegotiationPolicy, guardrails?: MerchantGuardrailConfig): NegotiationResult {
    const isNegotiationEnabled = guardrails ? guardrails.negotiationEnabled : policy.enabled;
    const effectiveNegotiable = policy.negotiable && isNegotiationEnabled;

    if (!effectiveNegotiable) {
      return { 
        allowed: false, 
        reason: "Resource is not negotiable or negotiation is disabled", 
        approvedPriceMinor: proposal.originalPriceMinor 
      };
    }
    
    
    // Policy-defined max discount. 0 means "no explicit policy limit".
    let maxAllowedDiscountBps = policy.maxDiscountBps || 0;
    if (guardrails && guardrails.maxDiscountBps > 0) {
      // Guardrails form a hard ceiling. If policy has no explicit limit (0),
      // use the guardrail limit. Otherwise take the stricter (lower) of the two.
      maxAllowedDiscountBps = maxAllowedDiscountBps === 0
        ? guardrails.maxDiscountBps
        : Math.min(maxAllowedDiscountBps, guardrails.maxDiscountBps);
    }

    let appliedRule = "maximum discount";

    if (policy.quantityDiscountTiers && policy.quantityDiscountTiers.length > 0) {
      const applicableTiers = policy.quantityDiscountTiers.filter(t => proposal.quantity >= t.minQuantity);
      if (applicableTiers.length > 0) {
        applicableTiers.sort((a, b) => b.minQuantity - a.minQuantity);
        const bestTier = applicableTiers[0];
        if (bestTier.discountBps > maxAllowedDiscountBps) {
          maxAllowedDiscountBps = bestTier.discountBps;
          appliedRule = `quantity discount tier >= ${bestTier.minQuantity}`;
        }
      }
    }

    // 1. Discount floor: We round down the allowable discount, effectively making the floor higher (safer).
    const discountAllowedMinor = Math.floor((proposal.originalPriceMinor * maxAllowedDiscountBps) / 10000);
    const discountFloor = proposal.originalPriceMinor - discountAllowedMinor;

    // 2. Margin floor: We round up the required margin, effectively making the floor higher (safer).
    let marginFloor = 0;
    let effectiveMinMarginBps = policy.minimumMarginBps;
    if (guardrails && guardrails.minimumMarginBps > 0) {
      effectiveMinMarginBps = effectiveMinMarginBps === undefined 
        ? guardrails.minimumMarginBps
        : Math.max(effectiveMinMarginBps, guardrails.minimumMarginBps);
    }

    if (effectiveMinMarginBps !== undefined && effectiveMinMarginBps > 0) {
      if (proposal.costMinor === undefined) {
         return { 
           allowed: false, 
           reason: "Cost is missing but minimum margin policy is enforced", 
           approvedPriceMinor: proposal.originalPriceMinor 
         };
      }
      marginFloor = proposal.costMinor + Math.ceil((proposal.costMinor * effectiveMinMarginBps) / 10000);
    }

    // 3. Absolute floor
    const absoluteFloor = policy.absoluteFloorMinor || 0;

    // The strictest floor wins
    const finalFloor = Math.max(discountFloor, marginFloor, absoluteFloor);

    // Calculate margin safely if cost is present
    const calculateMargin = (price: number) => {
      return proposal.costMinor !== undefined ? (price - proposal.costMinor) : undefined;
    };

    if (proposal.proposedPriceMinor >= finalFloor) {
      // Never allow them to charge MORE than the original price through negotiation.
      if (proposal.proposedPriceMinor > proposal.originalPriceMinor) {
        return {
          allowed: false,
          approvedPriceMinor: proposal.originalPriceMinor,
          reason: "Proposal exceeds original price",
          appliedRule: "original price cap",
          savingsMinor: 0,
          marginMinor: calculateMargin(proposal.originalPriceMinor),
        };
      }

      return {
        allowed: true,
        approvedPriceMinor: proposal.proposedPriceMinor,
        reason: "Proposal satisfies all pricing floors",
        appliedRule,
        savingsMinor: proposal.originalPriceMinor - proposal.proposedPriceMinor,
        marginMinor: calculateMargin(proposal.proposedPriceMinor),
      };
    } else {
      let failReason = `Proposal below price floor (${finalFloor})`;
      if (finalFloor === marginFloor) failReason = "Proposal violates minimum margin";
      else if (finalFloor === discountFloor) failReason = "Proposal violates maximum discount";
      else if (finalFloor === absoluteFloor) failReason = "Proposal violates absolute floor";

      return {
        allowed: false,
        approvedPriceMinor: finalFloor,
        reason: failReason,
        appliedRule,
        savingsMinor: proposal.originalPriceMinor - finalFloor,
        marginMinor: calculateMargin(finalFloor),
      };
    }
  }
}
