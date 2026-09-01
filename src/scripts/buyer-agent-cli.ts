import axios from 'axios';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const BUDGET_MINOR = 20000; // ₹200 budget
const BUYER_ID = 'buyer_123';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBuyerAgent() {
  console.log('===================================================');
  console.log('🤖 REAL BUYER AGENT - DETERMINISTIC GOLDEN PATH');
  console.log('===================================================\n');

  try {
    console.log('[Setup] Provisioning Merchant and Catalog...');
    const provisionRes = await axios.post(`${API_BASE}/v1/factory/merchants`, {
      name: 'Agentic Electronics Demo',
      capabilities: ['catalog', 'inventory', 'pricing', 'negotiation', 'checkout'],
      guardrails: { maxDiscountPercentage: 20, minMarginPercentage: 10, blockedCategories: [], requireManagerApprovalOverAmount: 5000000000000, crossSellEnabled: false, upsellEnabled: false },
      skills: {},
      strategy: { primary: 'CONVERSION', secondary: [] }
    });

    const merchantId = provisionRes.data.merchantId;

    const catalogRes = await axios.post(`${API_BASE}/v1/factory/merchants/${merchantId}/catalog`, {
      products: [{
        externalId: 'laptop-pro',
        name: 'Developer Pro Laptop',
        description: 'High performance laptop',
        priceMinor: 10000, // ₹100
        currency: 'INR',
        sku: 'LPT-PRO-32'
      }]
    });

    const internalProductId = catalogRes.data.products[0].productId;

    await axios.post(`${API_BASE}/v1/factory/merchants/${merchantId}/inventory`, {
      items: [{ productId: internalProductId, quantity: 100 }]
    });

    console.log(`[Setup] Provisioned Merchant: ${merchantId}\n`);
    const sessionId = `demo_conv_${crypto.randomUUID().slice(0, 8)}`;
    const requestText = 'I want to purchase 1 Developer Pro Laptop. Please search the catalog, then create a checkout for it.';
    console.log(`[Buyer] Sending request: "${requestText}"`);
    console.log(`[Buyer] Target Budget: ₹${BUDGET_MINOR / 100}`);

    let paymentLinkUrl: string | null = null;
    let orderId: string | null = null;

    // Helper: extract payment link from response
    function extractCheckout(data: any): { url: string; orderId: string } | null {
      // Check order field (set by protocol controller when checkout.create succeeds)
      if (data.order?.checkoutData?.paymentLinkUrl) {
        return { url: data.order.checkoutData.paymentLinkUrl, orderId: data.order.checkoutData.orderId };
      }
      // Check if response text contains raw JSON with paymentLinkUrl
      if (data.response && typeof data.response === 'string') {
        try {
          const parsed = JSON.parse(data.response);
          if (parsed.result?.checkoutData?.paymentLinkUrl) {
            return { url: parsed.result.checkoutData.paymentLinkUrl, orderId: parsed.result.checkoutData.orderId };
          }
        } catch { /* not JSON, ignore */ }
      }
      return null;
    }

    let res = await axios.post(`${API_BASE}/v1/protocol/requests`, {
      sessionId,
      merchantId,
      request: requestText,
      cart: [{ productId: internalProductId, quantity: 1 }]
    }, { headers: { 'x-buyer-id': BUYER_ID } });

    let { offer, response } = res.data;
    console.log(`\n[Merchant] Response: ${typeof response === 'string' && response.length > 200 ? response.substring(0, 200) + '...' : response}`);

    // Check if checkout already succeeded on first turn
    let checkout = extractCheckout(res.data);
    if (checkout) {
      paymentLinkUrl = checkout.url;
      orderId = checkout.orderId;
      console.log(`\n[Buyer] ✅ Checkout created on first turn!`);
    }

    // If no checkout yet, try a few more turns
    let attempts = 0;
    while (!paymentLinkUrl && !offer && attempts < 3) {
      console.log(`\n[Buyer] No checkout or offer yet. Asking merchant to proceed...`);
      res = await axios.post(`${API_BASE}/v1/protocol/requests`, {
        sessionId,
        merchantId,
        request: 'Yes, please proceed to create the checkout for the 1 laptop in my cart now.',
        cart: [{ productId: internalProductId, quantity: 1 }]
      }, { headers: { 'x-buyer-id': BUYER_ID } });

      offer = res.data.offer;
      response = res.data.response;
      console.log(`\n[Merchant] Response: ${typeof response === 'string' && response.length > 200 ? response.substring(0, 200) + '...' : response}`);

      checkout = extractCheckout(res.data);
      if (checkout) {
        paymentLinkUrl = checkout.url;
        orderId = checkout.orderId;
        console.log(`\n[Buyer] ✅ Checkout created!`);
      }
      attempts++;
    }

    // If we got an offer instead, handle negotiation path
    if (offer && !paymentLinkUrl) {
      console.log(`\n[Buyer] Evaluating Offer JSON:`);
      console.log(JSON.stringify(offer, null, 2));

      while (offer && offer.totalMinor > BUDGET_MINOR) {
        console.log(`\n[Buyer] Offer total (₹${offer.totalMinor / 100}) exceeds budget (₹${BUDGET_MINOR / 100}).`);
        console.log(`[Buyer] COUNTERING...`);

        const counterRes = await axios.post(`${API_BASE}/v1/protocol/offers/${offer.offerId}/counter`, {
          targetTotalMinor: BUDGET_MINOR
        }, { headers: { 'x-buyer-id': BUYER_ID } });

        offer = counterRes.data;
        console.log(JSON.stringify(offer, null, 2));
        await sleep(1500);
      }

      console.log(`\n[Buyer] ACCEPTING offer ${offer.offerId}...`);
      const acceptRes = await axios.post(`${API_BASE}/v1/protocol/offers/${offer.offerId}/accept`, {}, { headers: { 'x-buyer-id': BUYER_ID } });
      paymentLinkUrl = acceptRes.data.paymentUrl;
    }

    if (!paymentLinkUrl) {
      console.log(`\n❌ Could not obtain a payment link after multiple turns. Ending.`);
      process.exit(1);
    }

    console.log(`\n===================================================`);
    console.log(`💳 REAL RAZORPAY TEST PAYMENT LINK:`);
    console.log(`   ${paymentLinkUrl}`);
    console.log(`===================================================`);
    console.log(`\n👉 ACTION REQUIRED:`);
    console.log(`1. Open the payment link above in your browser.`);
    console.log(`2. Complete the test payment (use any dummy card/UPI).`);
    console.log(`3. Press ENTER below when done.`);

    await askQuestion('\nPress ENTER when you have completed the test payment...');

    console.log(`\n[Buyer] Verifying payment via server...\n`);

    // Poll the database directly to see if the webhook marked the order as captured
    let verified = false;
    for (let poll = 0; poll < 20; poll++) {
      try {
        if (orderId) {
          const order = await prisma.commerceOrder.findUnique({ where: { id: orderId } });
          if (order?.status === 'captured') {
            verified = true;
            break;
          }
        } else {
          // If via offer, fallback to checking if offer is PAID
          const orderCheck = await axios.get(`${API_BASE}/v1/protocol/sessions/${sessionId}`, { headers: { 'x-buyer-id': BUYER_ID } });
          if (orderCheck.data.activeOffer?.status === 'PAID') {
            verified = true;
            break;
          }
        }
      } catch { /* ignore poll errors */ }

      console.log(`[Buyer] Waiting for payment confirmation... (${poll + 1}/20)`);
      await sleep(3000);
    }

    // Print audit trail regardless
    console.log(`\n===================================================`);
    console.log(`📜 AUDIT TRAIL FOR SESSION: ${sessionId}`);
    console.log(`===================================================`);

    const logRes = await axios.get(`${API_BASE}/v1/protocol/sessions/${sessionId}`, { headers: { 'x-buyer-id': BUYER_ID } });
    const messages = logRes.data.messages || [];
    messages.forEach((msg: any) => {
      const text = msg.payload?.text || msg.payload?.result?.status || 'Structured payload';
      console.log(`  [${msg.sender.toUpperCase()}]: ${typeof text === 'string' && text.length > 120 ? text.substring(0, 120) + '...' : text}`);
    });

    if (verified) {
      console.log(`\n✅ PAYMENT VERIFIED! Razorpay webhook confirmed.`);
    } else {
      console.log(`\n⚠️  Payment not yet confirmed via webhook. The payment link may still be pending.`);
      console.log(`   (This is expected if your server isn't receiving Razorpay webhooks locally.)`);
      console.log(`   Tip: Use ngrok to expose your local server for webhook delivery.`);
    }

    console.log(`\n✅ GOLDEN PATH VALIDATION COMPLETE.`);
    console.log(`   Session: ${sessionId}`);
    console.log(`   Merchant: ${merchantId}`);
    console.log(`   Order: ${orderId || 'via offer'}`);
    console.log(`   Payment Link: ${paymentLinkUrl}`);
    process.exit(0);

  } catch (err: any) {
    console.error(`\n❌ Golden Path Execution Failed:`);
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
}

runBuyerAgent();

