export interface GenUICard {
  type: 
    | 'PRODUCT'
    | 'OFFER'
    | 'QUOTE'
    | 'NEGOTIATION'
    | 'CHECKOUT'
    | 'PAYMENT'
    | 'APPROVAL'
    | 'RECOVERY'
    | 'FAILURE'
    | 'REVENUE_IMPACT'
    | 'AUDIT_TIMELINE';
  title: string;
  data: Record<string, any>;
  timestamp: string;
}

export class GenUIBuilder {
  static renderProduct(product: { id: string; name: string; priceMinor: number; currency: string; description?: string }, inventoryQty: number): GenUICard {
    return {
      type: 'PRODUCT',
      title: `Product: ${product.name}`,
      data: {
        id: product.id,
        name: product.name,
        priceFormatted: `${product.currency || 'INR'} ${(product.priceMinor / 100).toFixed(2)}`,
        priceMinor: product.priceMinor,
        currency: product.currency || 'INR',
        description: product.description || '',
        inStock: inventoryQty > 0,
        availableQuantity: inventoryQty
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderOffer(opportunity: { id: string; type: string; expectedImpactValue: number; confidence: number; evidence: string; proposedAction: any }): GenUICard {
    return {
      type: 'OFFER',
      title: `AI Opportunity: ${opportunity.type}`,
      data: {
        id: opportunity.id,
        type: opportunity.type,
        expectedImpactValue: opportunity.expectedImpactValue,
        confidence: opportunity.confidence,
        evidence: opportunity.evidence,
        proposedAction: opportunity.proposedAction
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderQuote(cartId: string, items: Array<{ productId: string; name: string; quantity: number; unitPriceMinor: number }>): GenUICard {
    const totalMinor = items.reduce((sum, item) => sum + (item.unitPriceMinor * item.quantity), 0);
    return {
      type: 'QUOTE',
      title: 'Bulk Pricing Quote',
      data: {
        cartId,
        items,
        totalFormatted: `INR ${(totalMinor / 100).toFixed(2)}`,
        totalMinor
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderNegotiation(proposal: { productId: string; originalPriceMinor: number; proposedPriceMinor: number; floorPriceMinor?: number; decision: string; counterPriceMinor?: number }): GenUICard {
    return {
      type: 'NEGOTIATION',
      title: `Price Negotiation: ${proposal.decision}`,
      data: {
        productId: proposal.productId,
        originalPriceMinor: proposal.originalPriceMinor,
        proposedPriceMinor: proposal.proposedPriceMinor,
        floorPriceMinor: proposal.floorPriceMinor,
        decision: proposal.decision,
        finalPriceMinor: proposal.counterPriceMinor || proposal.proposedPriceMinor
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderCheckout(orderId: string, totalMinor: number, currency: string, items: Array<{ productId: string; quantity: number; price: number }>): GenUICard {
    return {
      type: 'CHECKOUT',
      title: 'Checkout Review',
      data: {
        orderId,
        totalFormatted: `${currency} ${(totalMinor / 100).toFixed(2)}`,
        totalMinor,
        currency,
        items
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderPayment(razorpayOrderId: string, amountMinor: number, currency: string, razorpayKeyId?: string): GenUICard {
    return {
      type: 'PAYMENT',
      title: 'Razorpay Payment Widget',
      data: {
        razorpayOrderId,
        amountMinor,
        currency,
        razorpayKeyId: razorpayKeyId || ''
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderApproval(opportunityId: string, type: string, amountMinor: number, thresholdMinor: number): GenUICard {
    return {
      type: 'APPROVAL',
      title: 'Human Review Required',
      data: {
        opportunityId,
        type,
        amountMinor,
        thresholdMinor,
        reason: `Amount (₹${amountMinor / 100}) exceeds approval threshold (₹${thresholdMinor / 100})`
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderRecovery(opportunityId: string, reason: string, discountBps: number, cartItems: any[]): GenUICard {
    return {
      type: 'RECOVERY',
      title: 'Revenue Recovery Proposal',
      data: {
        opportunityId,
        reason,
        discountBps,
        cartItems
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderFailure(errorCode: string, errorMessage: string): GenUICard {
    return {
      type: 'FAILURE',
      title: `Error: ${errorCode}`,
      data: {
        code: errorCode,
        message: errorMessage
      },
      timestamp: new Date().toISOString()
    };
  }

  static renderRevenueImpact(metrics: { totalRevenue: number; aiAssistedRevenue: number; conversionRate: number; cohorts?: any }): GenUICard {
    return {
      type: 'REVENUE_IMPACT',
      title: 'AI Revenue Performance',
      data: metrics,
      timestamp: new Date().toISOString()
    };
  }

  static renderAuditTimeline(events: Array<{ id: string; action: string; status: string; timestamp: string }>): GenUICard {
    return {
      type: 'AUDIT_TIMELINE',
      title: 'Safety & Action Audit Trail',
      data: { events },
      timestamp: new Date().toISOString()
    };
  }
}
