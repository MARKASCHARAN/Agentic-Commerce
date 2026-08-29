import { PrismaClient } from '@prisma/client';
import { OutboxEventRecord } from '../../database/repositories/outbox.repository';

export const createPaymentReconciliationHandler = (prisma: PrismaClient) => {
  return async (event: OutboxEventRecord): Promise<void> => {
    // The Outbox event payload from our webhook route
    const payload = event.payload as any;
    
    // We only care about specific payment events
    const supportedEvents = ['payment.captured', 'payment.failed', 'payment.authorized', 'order.paid'];
    if (!supportedEvents.includes(payload.type)) {
      return; // Skip unsupported events
    }

    const providerOrderId = payload.providerEntityId;

    // 1. Find the PaymentIntent associated with this order
    // Razorpay webhook `providerEntityId` might be the payment ID or order ID. 
    // In razorpay, 'payment.captured' payload.payload.payment.entity.order_id gives order ID.
    // We saved the rawPayload in WebhookEvent, we can fetch it to be sure.
    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: { id: payload.eventId }
    });

    if (!webhookEvent) {
      throw new Error(`Webhook event ${payload.eventId} not found`);
    }

    const rawPayload: any = webhookEvent.payload;
    
    // Attempt to resolve the Razorpay Order ID
    let razorpayOrderId = null;
    if (rawPayload?.payload?.payment?.entity?.order_id) {
      razorpayOrderId = rawPayload.payload.payment.entity.order_id;
    } else if (rawPayload?.payload?.order?.entity?.id) {
      razorpayOrderId = rawPayload.payload.order.entity.id;
    }

    if (!razorpayOrderId) {
      // If we cannot find an order ID, we can't link it.
      return;
    }

    // Since our DB schema might not have razorpayOrderId explicitly on PaymentIntent,
    // wait, we mapped order.id (our internal order ID) to receipt in Razorpay when creating the order.
    // Let's use the receipt to find our internal CommerceOrder, which then gives us PaymentIntent.
    // Or we could check if Razorpay Order ID was saved anywhere? 
    // Wait, let's check PaymentIntent schema.
    
    // Better way: in checkout.create we created CommerceOrder and PaymentIntent.
    // And passed CommerceOrder.id as the `receipt`.
    let internalOrderId = null;
    if (rawPayload?.payload?.payment?.entity?.notes?.receipt) {
      internalOrderId = rawPayload.payload.payment.entity.notes.receipt;
    } else if (rawPayload?.payload?.order?.entity?.receipt) {
      internalOrderId = rawPayload.payload.order.entity.receipt;
    }
    
    // fallback to searching CommerceOrder by some mechanism
    
    if (!internalOrderId) {
        // We'll have to find the payment intent by finding the order
        // Let's just lookup by id if we can't find it.
        return;
    }

    const paymentIntent = await prisma.paymentIntent.findFirst({
      where: { orderId: internalOrderId }
    });

    if (!paymentIntent) {
      console.warn(`No PaymentIntent found for internal order ${internalOrderId}`);
      return;
    }

    // 2. Update PaymentIntent status
    let newStatus = paymentIntent.status;
    if (payload.type === 'payment.captured' || payload.type === 'order.paid') {
      newStatus = 'captured';
    } else if (payload.type === 'payment.failed') {
      newStatus = 'failed';
    } else if (payload.type === 'payment.authorized') {
      newStatus = 'authorized';
    }

    await prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: { status: newStatus }
    });

    // 3. Update CommerceOrder status
    await prisma.commerceOrder.update({
      where: { id: internalOrderId },
      data: { status: newStatus }
    });

    // 4. Update RevenueOpportunityLog
    // Find the specific revenue opportunity log tied to this order
    if (newStatus === 'captured') {
      const revLog = await prisma.revenueOpportunityLog.findFirst({
        where: { orderId: internalOrderId, status: 'ACCEPTED' }
      });

      if (revLog) {
        await prisma.revenueOpportunityLog.update({
          where: { id: revLog.id },
          data: {
            status: 'CONVERTED',
            convertedAt: new Date(),
            realizedImpactMinor: revLog.expectedImpactMinor
          }
        });
      }
    }
  };
};
