import { PrismaClient } from '@prisma/client';
import { ResendEmailProvider } from '../../infrastructure/resend/resend.provider.js';

export interface PaymentReconciliationResult {
  status: 'MATCH' | 'MISMATCH' | 'NOT_FOUND';
  internalOrder?: any;
  razorpayPayment?: any;
  razorpayOrder?: any;
  discrepancyReason?: string;
}

export async function reconcilePayment(
  prisma: PrismaClient,
  internalOrderId: string,
  razorpayPaymentId?: string,
  razorpayOrderId?: string
): Promise<PaymentReconciliationResult> {
  const internalOrder = await prisma.commerceOrder.findUnique({
    where: { id: internalOrderId }
  });

  if (!internalOrder) {
    return { status: 'NOT_FOUND', discrepancyReason: `Internal order ${internalOrderId} not found` };
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { orderId: internalOrderId }
  });

  const intentAny = intent as any;
  const orderAny = internalOrder as any;

  let fetchedRazorpayOrderId = razorpayOrderId || intentAny?.razorpayOrderId;
  let fetchedRazorpayPaymentId = razorpayPaymentId || intentAny?.razorpayPaymentId;

  if (!fetchedRazorpayPaymentId) {
    try {
      const webhook = await prisma.webhookEvent.findFirst({
        where: {
          eventType: 'payment.captured'
        },
        orderBy: { processedAt: 'desc' }
      });
      if (webhook && webhook.payload && typeof webhook.payload === 'object') {
        const payload: any = webhook.payload;
        if (payload?.payment?.entity?.notes?.receipt === internalOrderId) {
          fetchedRazorpayPaymentId = payload.payment.entity.id;
          fetchedRazorpayOrderId = fetchedRazorpayOrderId || payload.payment.entity.order_id;
        }
      }
    } catch (err) {
      console.warn('[Reconciliation] Webhook log search skipped', err);
    }
  }

  let discrepancy: string | undefined;
  
  if (intentAny && intentAny.razorpayOrderId) {
    if (fetchedRazorpayOrderId && fetchedRazorpayOrderId !== intentAny.razorpayOrderId) {
      discrepancy = `Razorpay Order ID mismatch: intent had ${intentAny.razorpayOrderId}, received ${fetchedRazorpayOrderId}`;
    }
  }

  const offer = await prisma.offer.findFirst({
    where: { orderId: internalOrderId }
  });

  const isMatch = !discrepancy && (
    internalOrder.status === 'captured' || 
    internalOrder.status === 'PAID' || 
    offer?.status === 'PAID' || 
    !!fetchedRazorpayPaymentId
  );
  const newStatus = isMatch ? 'captured' : 'RECONCILIATION_FAILED';

  const orderAmountMinor = Math.round(internalOrder.total * 100);

  await prisma.commerceOrder.update({
    where: { id: internalOrderId },
    data: {
      status: newStatus,
      updatedAt: new Date()
    }
  });

  if (intent) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: isMatch ? 'captured' : 'FAILED',
        updatedAt: new Date()
      }
    });
  }

  const buyerEmail = orderAny?.buyerEmail || intentAny?.buyerEmail;
  if (newStatus === 'captured' && buyerEmail) {
    try {
      const emailProvider = new ResendEmailProvider();
      const html = `
        <h2>Payment Confirmed</h2>
        <p>Your payment for order <strong>${internalOrderId}</strong> was successfully captured.</p>
        <p>Thank you for your purchase!</p>
      `;
      await emailProvider.sendEmail(buyerEmail, 'Payment Confirmed', html);
      console.log(`[Reconciliation] Successfully sent Payment Confirmed email to ${buyerEmail}`);
    } catch (e: any) {
      console.warn(`[Reconciliation] Failed to send Payment Confirmed email: ${e.message}`);
    }
  }

  if (newStatus === 'captured') {
    const revLog = await prisma.revenueOpportunityLog.findFirst({
      where: {
        OR: [
          { orderId: internalOrderId },
          { sessionId: internalOrder.sessionId || undefined }
        ],
        status: { in: ['PROPOSED', 'ACCEPTED', 'CONVERTED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (revLog) {
      await prisma.revenueOpportunityLog.update({
        where: { id: revLog.id },
        data: {
          status: 'CONVERTED',
          orderId: internalOrderId,
          convertedAt: new Date(),
          realizedImpactMinor: orderAmountMinor > 0 ? orderAmountMinor : revLog.expectedImpactMinor
        }
      });
    }
  }

  if (offer) {
    await prisma.offer.update({
      where: { id: offer.id },
      data: { status: 'PAID' }
    });
  }

  return {
    status: isMatch ? 'MATCH' : 'MISMATCH',
    internalOrder,
    discrepancyReason: discrepancy,
    razorpayPayment: { id: fetchedRazorpayPaymentId, amount: orderAmountMinor },
    razorpayOrder: { id: fetchedRazorpayOrderId, amount: orderAmountMinor }
  };
}

export function createPaymentReconciliationHandler(prisma: PrismaClient) {
  return async (payloadOrEvent: any, event?: any) => {
    try {
      const payload = payloadOrEvent?.payload || payloadOrEvent;
      let internalOrderId = payload?.internalOrderId || payload?.orderId || payload?.notesReceipt || payload?.notes?.receipt;

      if (!internalOrderId && payload?.eventId) {
        const webhook = await prisma.webhookEvent.findUnique({
          where: { id: payload.eventId }
        });
        if (webhook && typeof webhook.payload === 'object') {
          const wPayload: any = webhook.payload;
          internalOrderId = wPayload?.payment?.entity?.notes?.receipt || wPayload?.payload?.payment?.entity?.notes?.receipt;
        }
      }

      const razorpayPaymentId = payload?.razorpayPaymentId || payload?.paymentId;
      const razorpayOrderId = payload?.razorpayOrderId;
      if (internalOrderId) {
        await reconcilePayment(prisma, internalOrderId, razorpayPaymentId, razorpayOrderId);
      }
    } catch (error: any) {
      console.error('[ReconciliationHandler Error]', error);
    }
  };
}
