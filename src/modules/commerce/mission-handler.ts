import { PrismaClient } from '@prisma/client';
import { PrismaCatalogProvider } from '../catalog/prisma-catalog.provider.js';
import { RevenueIntelligenceEngine } from '../revenue/revenue-engine.js';
import { ModelGateway } from '../../infrastructure/ai/model-gateway.js';
import { ProtocolEngine } from '../agent/protocol/protocol-engine.js';
import { PricingService } from '../revenue/pricing-service.js';
import { RazorpayProvider } from '../../infrastructure/razorpay/razorpay.provider.js';
import { ResendEmailProvider } from '../../infrastructure/resend/resend.provider.js';
import { DecisionLogger } from '../audit/decision-logger.js';
import { env } from '../../config/env.js';

export interface CommerceMissionPayload {
  eventId?: string;
  merchantId: string;
  buyerId: string;
  sessionId: string;
  budgetMinor: number;
  requirements: string;
  buyerEmail: string;
}

export function createCommerceMissionHandler(prisma: PrismaClient) {
  const catalogProvider = new PrismaCatalogProvider(prisma);
  const modelGateway = new ModelGateway();
  const revenueEngine = new RevenueIntelligenceEngine(modelGateway, undefined, prisma);
  const decisionLogger = new DecisionLogger(prisma);
  const pricingService = new PricingService(prisma);
  const paymentProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');
  const protocolEngine = new ProtocolEngine(prisma, pricingService, paymentProvider, decisionLogger);
  const resendProvider = new ResendEmailProvider();

  return async function handleCommerceMission(outboxEvent: { payload: CommerceMissionPayload }) {
    const { merchantId, buyerId, sessionId, budgetMinor, requirements, buyerEmail } = outboxEvent.payload;

    console.log(`[CommerceMissionHandler] Processing asynchronous mission for buyer ${buyerEmail} (budget: ₹${budgetMinor / 100})...`);

    // 1. Search Catalog
    const searchResults = await catalogProvider.search(merchantId, requirements);
    if (searchResults.length === 0) {
      throw new Error(`No products matching "${requirements}" found for merchant ${merchantId}`);
    }

    const primaryProduct = searchResults[0];

    // 2. Analyze Revenue Opportunities (Cross-sell / Bundles)
    const opportunity = await revenueEngine.analyze(merchantId, {
      sessionId,
      cartProductIds: [primaryProduct.id],
      subtotalMinor: primaryProduct.priceMinor
    });

    const selectedItems = [{ productId: primaryProduct.id, quantity: 1 }];

    // Include recommended accessory if opportunity exists and fits budget
    if (opportunity && opportunity.proposedAction?.resourceId) {
      const accessoryId = opportunity.proposedAction.resourceId;
      const accessory = await prisma.product.findUnique({ where: { id: accessoryId } });
      if (accessory && (primaryProduct.priceMinor + accessory.priceMinor) <= budgetMinor * 1.05) {
        selectedItems.push({ productId: accessory.id, quantity: 1 });
      }
    }

    // 3. Calculate initial subtotal
    let subtotalMinor = 0;
    const pricedItems = [];
    for (const item of selectedItems) {
      const prod = await prisma.product.findUnique({ where: { id: item.productId } });
      if (prod) {
        subtotalMinor += prod.priceMinor * item.quantity;
        pricedItems.push({
          productId: prod.id,
          quantity: item.quantity,
          unitPriceMinor: prod.priceMinor
        });
      }
    }

    // 4. Create Initial Offer in Database
    const initialOffer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: pricedItems as any,
        subtotalMinor,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: subtotalMinor,
        currency: primaryProduct.currency,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 86400000)
      }
    });

    // 5. Negotiate optimal pricing within guardrails if subtotal exceeds budget
    let finalOffer = initialOffer;
    if (initialOffer.subtotalMinor > budgetMinor) {
      finalOffer = await protocolEngine.counterOffer(initialOffer.id, merchantId, budgetMinor);
    }

    // 6. Accept Offer & Generate Payment Link
    const acceptResult = await protocolEngine.acceptOffer(finalOffer.id, buyerId);

    // 7. Deliver Asynchronous Negotiation Proposal Email to Buyer
    const itemsList = await Promise.all(
      (finalOffer.items as any[]).map(async (i) => {
        const prod = await prisma.product.findUnique({ where: { id: i.productId } });
        return `<li><strong>${prod?.name || 'Product'}</strong> (x${i.quantity}) — ₹${(i.unitPriceMinor * i.quantity / 100).toLocaleString('en-IN')}</li>`;
      })
    );

    const savedAmount = Math.max(0, (finalOffer.subtotalMinor - finalOffer.totalMinor) / 100);

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e6ea; border-radius: 12px; overflow: hidden; color: #121727;">
        <div style="background-color: #0c1a30; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Agentic Commerce Negotiation Complete</h1>
          <p style="margin-top: 8px; color: #8fa6c5; font-size: 14px;">Your AI Buyer Agent has negotiated a deal on your behalf.</p>
        </div>
        
        <div style="padding: 24px; background-color: #ffffff;">
          <div style="background-color: #f4f6fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #667085;">MISSION BUDGET</p>
            <h3 style="margin: 0; font-size: 20px; color: #121727;">₹${(budgetMinor / 100).toLocaleString('en-IN')}</h3>
          </div>

          <h4 style="margin-bottom: 12px; color: #121727;">Recommended & Negotiated Package:</h4>
          <ul style="padding-left: 20px; line-height: 1.6; color: #344054;">
            ${itemsList.join('')}
          </ul>

          <div style="border-top: 1px solid #eaecf0; margin-top: 20px; padding-top: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #667085;">Subtotal:</span>
              <span style="font-weight: 600;">₹${(finalOffer.subtotalMinor / 100).toLocaleString('en-IN')}</span>
            </div>
            ${savedAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #12b76a;">
              <span>Negotiated Discount Saved:</span>
              <span style="font-weight: 600;">-₹${savedAmount.toLocaleString('en-IN')}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #121727; border-top: 2px solid #121727; padding-top: 12px; margin-top: 8px;">
              <span>Final Total:</span>
              <span>₹${(finalOffer.totalMinor / 100).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style="text-align: center; margin-top: 32px; margin-bottom: 16px;">
            <a href="${acceptResult.paymentUrl}" style="background-color: #3366ff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
              Proceed to Secure Razorpay Payment →
            </a>
          </div>
          <p style="text-align: center; font-size: 12px; color: #667085; margin: 0;">Payment link generated safely via Razorpay Gateway. Final authorization remains in your control.</p>
        </div>
      </div>
    `;

    try {
      await resendProvider.sendEmail(
        buyerEmail,
        `🎉 Negotiation Complete: Your Negotiated Proposal (₹${(finalOffer.totalMinor / 100).toLocaleString('en-IN')})`,
        htmlContent
      );
      console.log(`[CommerceMissionHandler] Successfully emailed proposal to ${buyerEmail}`);
    } catch (e: any) {
      console.warn(`[CommerceMissionHandler] Email send warning:`, e.message);
    }

    console.log(`[CommerceMissionHandler] Mission ${outboxEvent.payload.eventId} processed successfully. Order ID: ${acceptResult.orderId}`);
  };
}
