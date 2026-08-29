import { describe, it, expect } from 'vitest';
import { GenUIBuilder } from '../../src/agent/genui/genui.builder';

describe('Phase 39: GenUI Merchant Commerce Experience', () => {
  it('1. Renders PRODUCT card correctly', () => {
    const card = GenUIBuilder.renderProduct({
      id: 'prod-1',
      name: 'Wireless Headphones',
      priceMinor: 499900,
      currency: 'INR',
      description: 'Noise cancelling'
    }, 15);

    expect(card.type).toBe('PRODUCT');
    expect(card.data.name).toBe('Wireless Headphones');
    expect(card.data.priceFormatted).toBe('INR 4999.00');
    expect(card.data.inStock).toBe(true);
  });

  it('2. Renders OFFER card correctly', () => {
    const card = GenUIBuilder.renderOffer({
      id: 'opp-1',
      type: 'CROSS_SELL',
      expectedImpactValue: 150000,
      confidence: 0.85,
      evidence: 'Bought with laptop',
      proposedAction: { actionType: 'ADD_PRODUCT', resourceId: 'prod-mouse' }
    });

    expect(card.type).toBe('OFFER');
    expect(card.data.type).toBe('CROSS_SELL');
    expect(card.data.confidence).toBe(0.85);
  });

  it('3. Renders QUOTE card correctly', () => {
    const card = GenUIBuilder.renderQuote('cart-100', [
      { productId: 'prod-1', name: 'Item A', quantity: 10, unitPriceMinor: 1000 }
    ]);

    expect(card.type).toBe('QUOTE');
    expect(card.data.totalMinor).toBe(10000);
    expect(card.data.totalFormatted).toBe('INR 100.00');
  });

  it('4. Renders NEGOTIATION card correctly', () => {
    const card = GenUIBuilder.renderNegotiation({
      productId: 'prod-1',
      originalPriceMinor: 5000,
      proposedPriceMinor: 4500,
      floorPriceMinor: 4000,
      decision: 'ACCEPT'
    });

    expect(card.type).toBe('NEGOTIATION');
    expect(card.data.decision).toBe('ACCEPT');
    expect(card.data.finalPriceMinor).toBe(4500);
  });

  it('5. Renders CHECKOUT card correctly', () => {
    const card = GenUIBuilder.renderCheckout('order-1', 5000, 'INR', [{ productId: 'p1', quantity: 1, price: 50 }]);
    expect(card.type).toBe('CHECKOUT');
    expect(card.data.orderId).toBe('order-1');
  });

  it('6. Renders PAYMENT card correctly', () => {
    const card = GenUIBuilder.renderPayment('order_rzp_123', 5000, 'INR', 'rzp_test_key');
    expect(card.type).toBe('PAYMENT');
    expect(card.data.razorpayOrderId).toBe('order_rzp_123');
    expect(card.data.razorpayKeyId).toBe('rzp_test_key');
  });

  it('7. Renders APPROVAL card correctly', () => {
    const card = GenUIBuilder.renderApproval('opp-review-1', 'UPGRADE', 150000, 100000);
    expect(card.type).toBe('APPROVAL');
    expect(card.data.opportunityId).toBe('opp-review-1');
  });

  it('8. Renders RECOVERY card correctly', () => {
    const card = GenUIBuilder.renderRecovery('opp-rec-1', 'Payment failure detected', 500, []);
    expect(card.type).toBe('RECOVERY');
    expect(card.data.discountBps).toBe(500);
  });

  it('9. Renders FAILURE card correctly', () => {
    const card = GenUIBuilder.renderFailure('INSUFFICIENT_STOCK', 'Item out of stock');
    expect(card.type).toBe('FAILURE');
    expect(card.data.code).toBe('INSUFFICIENT_STOCK');
  });

  it('10. Renders REVENUE_IMPACT card correctly', () => {
    const card = GenUIBuilder.renderRevenueImpact({ totalRevenue: 1000, aiAssistedRevenue: 300, conversionRate: 25 });
    expect(card.type).toBe('REVENUE_IMPACT');
    expect(card.data.aiAssistedRevenue).toBe(300);
  });

  it('11. Renders AUDIT_TIMELINE card correctly', () => {
    const card = GenUIBuilder.renderAuditTimeline([
      { id: 'e1', action: 'PAYMENT_CAP', status: 'SUCCESS', timestamp: new Date().toISOString() }
    ]);
    expect(card.type).toBe('AUDIT_TIMELINE');
    expect(card.data.events.length).toBe(1);
  });
});
