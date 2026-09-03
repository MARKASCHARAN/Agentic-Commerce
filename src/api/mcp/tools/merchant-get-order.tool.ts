import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';

const prisma = new PrismaClient();

export const getOrderTool = {
  name: 'merchant.get_order',
  description: `Retrieve the status and details of a commerce order.

AUTHORITATIVE DATA RULE
The merchant backend is the sole authority for:
- order status
- payment status
- amount
- items
- quantity
- razorpayOrderId
- razorpayPaymentId
- currency

If merchant.get_order fails, do not infer or reconstruct any of these values from conversation history. Report the tool failure to the buyer.`,
  schema: {
    orderId: z.string().describe('The ID of the order to retrieve.')
  },
  handler: async ({ orderId }: { orderId: string }) => {
    try {
      const ctx = getMcpContext();

      // 1. Fetch exact CommerceOrder and its items
      const order = await prisma.commerceOrder.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, code: "ORDER_NOT_FOUND", message: "Order not found" }) }] };
      }

      // 2. Fetch the specific Offer tied strictly to THIS order ID
      const offer = await prisma.offer.findFirst({
        where: { orderId: order.id }
      });

      // 3. Resolve Razorpay Order ID / Link ID strictly for THIS transaction
      let razorpayOrderId: string | null = null;
      if (offer?.paymentUrl) {
        const match = offer.paymentUrl.match(/(order_[A-Za-z0-9]+|plink_[A-Za-z0-9]+|\/pay\/([A-Za-z0-9_]+)|\/rzp\/([A-Za-z0-9_]+))/);
        if (match) {
          razorpayOrderId = match[3] || match[2] || match[1];
        }
      }

      // 4. Query WebhookEvents strictly for THIS internal order ID (notes.receipt = order.id)
      let razorpayPaymentId: string | null = null;
      const webhookEvent = await prisma.webhookEvent.findFirst({
        where: {
          payload: { path: ['payload', 'payment', 'entity', 'notes', 'receipt'], equals: order.id }
        },
        orderBy: { processedAt: 'desc' }
      });

      if (webhookEvent?.payload) {
        const p = webhookEvent.payload as any;
        razorpayPaymentId = p?.payload?.payment?.entity?.id || p?.payload?.order?.entity?.id || null;
        if (p?.payload?.payment?.entity?.order_id) {
          razorpayOrderId = p.payload.payment.entity.order_id;
        }
      }

      const isCaptured = order.status === 'captured' || order.status === 'PAID' || offer?.status === 'PAID';
      const orderStatus = isCaptured ? 'PAID' : order.status;
      const paymentStatus = isCaptured ? 'CAPTURED' : (order.status === 'RECONCILIATION_FAILED' ? 'RECONCILIATION_FAILED' : 'AWAITING_PAYMENT');
      
      const stageMessage = isCaptured 
        ? "Payment successfully captured and reconciled."
        : (order.status === 'RECONCILIATION_FAILED' ? "Reconciliation failed: Amount mismatch." : "Payment preparation complete — awaiting human payment.");

      return {
        content: [{ type: "text", text: JSON.stringify({
          success: true,
          internalOrderId: order.id,
          razorpayOrderId: razorpayOrderId || "N/A (Pending payment link creation)",
          razorpayPaymentId: razorpayPaymentId || (isCaptured ? "pay_captured" : "N/A (Awaiting payment)"),
          orderStatus: orderStatus,
          paymentStatus: paymentStatus,
          amount: order.total,
          amountFormatted: `₹${order.total.toFixed(2)}`,
          currency: "INR",
          items: order.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
          stageMessage
        }, null, 2) }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "ORDER_RETRIEVAL_FAILED", message: e.message }) }] };
    }
  }
};
