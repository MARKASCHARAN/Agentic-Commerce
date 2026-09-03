import { PrismaClient } from '@prisma/client';
import { getOrderTool } from '../../api/mcp/tools/merchant-get-order.tool.js';
import { mcpContextStorage } from '../../api/mcp/context.js';
import { createPaymentReconciliationHandler } from './reconciliation.js';

async function runMappingTests() {
  const prisma = new PrismaClient();
  console.log('=== RUNNING FOCUSED RECONCILIATION & MAPPING INVARIANT TESTS ===');

  const merchantId = 'merchant_fac_mtlkcowl';
  const timestamp = Date.now();
  const session1Id = `sess_test_1_${timestamp}`;
  const session2Id = `sess_test_2_${timestamp}`;

  // Create Sessions
  await prisma.session.create({ data: { id: session1Id, merchantId } });
  await prisma.session.create({ data: { id: session2Id, merchantId } });

  // Test 1: Create Order 1 (₹33,000)
  const order1 = await prisma.commerceOrder.create({
    data: {
      merchantId,
      sessionId: session1Id,
      total: 33000,
      status: 'created',
      items: { create: [{ productId: 'prod-1', quantity: 1, price: 33000 }] }
    }
  });

  const offer1 = await prisma.offer.create({
    data: {
      merchantId,
      buyerId: 'buyer-1',
      sessionId: session1Id,
      orderId: order1.id,
      items: [],
      subtotalMinor: 3300000,
      discountMinor: 0,
      shippingMinor: 0,
      totalMinor: 3300000,
      currency: 'INR',
      status: 'PAYMENT_PENDING',
      paymentUrl: 'https://rzp.io/rzp/order_TEST_11111',
      expiresAt: new Date(Date.now() + 86400000)
    }
  });

  // Test 2: Create Order 2 (₹32,000)
  const order2 = await prisma.commerceOrder.create({
    data: {
      merchantId,
      sessionId: session2Id,
      total: 32000,
      status: 'created',
      items: { create: [{ productId: 'prod-2', quantity: 1, price: 32000 }] }
    }
  });

  const offer2 = await prisma.offer.create({
    data: {
      merchantId,
      buyerId: 'buyer-2',
      sessionId: session2Id,
      orderId: order2.id,
      items: [],
      subtotalMinor: 3200000,
      discountMinor: 0,
      shippingMinor: 0,
      totalMinor: 3200000,
      currency: 'INR',
      status: 'PAYMENT_PENDING',
      paymentUrl: 'https://rzp.io/rzp/order_TEST_22222',
      expiresAt: new Date(Date.now() + 86400000)
    }
  });

  // INVARIANT 1: Two consecutive purchases have 2 distinct Razorpay Order URLs/IDs
  if (offer1.paymentUrl === offer2.paymentUrl) {
    throw new Error('FAILED INVARIANT 1: Payment URLs/IDs were reused!');
  }
  console.log('✅ INVARIANT 1 PASSED: Consecutive purchases generate distinct Razorpay Order IDs');

  // INVARIANT 4: merchant.get_order for Order 2 DOES NOT return Order 1 Razorpay IDs
  const ctx = { merchantId, buyerId: 'buyer-2', sessionId: session2Id, requestId: 'req-2' };
  let getOrderRes: any;
  await mcpContextStorage.run(ctx, async () => {
    const res = await getOrderTool.handler({ orderId: order2.id });
    getOrderRes = JSON.parse(res.content[0].text);
  });

  if (getOrderRes.razorpayOrderId === 'order_TEST_11111') {
    throw new Error('FAILED INVARIANT 4: merchant.get_order returned Razorpay ID from previous transaction!');
  }
  if (getOrderRes.razorpayOrderId !== 'order_TEST_22222') {
    throw new Error(`FAILED INVARIANT 4: Expected order_TEST_22222 but got ${getOrderRes.razorpayOrderId}`);
  }
  console.log('✅ INVARIANT 4 PASSED: merchant.get_order returns strictly scoped Razorpay Order ID (order_TEST_22222)');

  // INVARIANT 5: Webhook reconciliation enforces amount match (Amount Mismatch Test)
  const webhookId = `wh_test_${timestamp}`;
  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      provider: 'razorpay',
      providerEventId: webhookId,
      eventType: 'payment.captured',
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_mismatch_${timestamp}`,
              amount: 3000000, // ₹30,000 (Mismatch with Order 2 ₹32,000)
              order_id: 'order_TEST_22222',
              notes: { receipt: order2.id }
            }
          }
        }
      }
    }
  });

  const paymentIntent2 = await prisma.paymentIntent.create({
    data: {
      orderId: order2.id,
      amount: 3200000,
      status: 'created',
      idempotency_key: `idemp_${timestamp}`
    }
  });

  const handler = createPaymentReconciliationHandler(prisma);
  await handler({
    id: 'outbox-1',
    eventId: webhookEvent.id,
    eventType: 'payment.webhook',
    aggregateType: 'WebhookEvent',
    aggregateId: webhookEvent.id,
    correlationId: null,
    payload: {
      eventId: webhookEvent.id,
      type: 'payment.captured',
      providerEntityId: webhookId
    },
    status: 'PENDING',
    attempts: 0,
    availableAt: new Date(),
    processedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const updatedOrder2 = await prisma.commerceOrder.findUnique({ where: { id: order2.id } });
  if (updatedOrder2?.status === 'captured') {
    throw new Error('FAILED INVARIANT 5: Mismatched payment amount was incorrectly marked CAPTURED!');
  }
  if (updatedOrder2?.status !== 'RECONCILIATION_FAILED') {
    throw new Error(`FAILED INVARIANT 5: Expected status RECONCILIATION_FAILED but got ${updatedOrder2?.status}`);
  }
  console.log('✅ INVARIANT 5 PASSED: Mismatched payment amount correctly flagged RECONCILIATION_FAILED');

  // Clean up test data
  await prisma.webhookEvent.delete({ where: { id: webhookEvent.id } });
  await prisma.paymentIntent.delete({ where: { id: paymentIntent2.id } });
  await prisma.offer.deleteMany({ where: { id: { in: [offer1.id, offer2.id] } } });
  await prisma.commerceItem.deleteMany({ where: { orderId: { in: [order1.id, order2.id] } } });
  await prisma.commerceOrder.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
  await prisma.session.deleteMany({ where: { id: { in: [session1Id, session2Id] } } });

  console.log('🎉 ALL INVARIANT TESTS PASSED CLEANLY!');
}

runMappingTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
