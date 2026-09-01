import fs from 'fs/promises';
import { CommerceClient } from './commerce-client.js';
import { BuyerPolicy, evaluateOffer } from './buyer-policy.js';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Command line arguments parsing
const args = process.argv.slice(2);
let requestText = 'I want to purchase the Laptop Pro 32GB.';
let budgetMinor = 5000000; // ₹50,000
let scenario = 'direct';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--request' && args[i + 1]) {
    requestText = args[i + 1];
    i++;
  } else if (args[i] === '--budget' && args[i + 1]) {
    budgetMinor = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--scenario' && args[i + 1]) {
    scenario = args[i + 1];
    i++;
  }
}

if (scenario === 'cross-sell') {
  requestText = 'I want to purchase the Laptop Pro 32GB, but I want to know if there are any good accessories for it before I checkout.';
  budgetMinor = 6000000; // ₹60,000
}

// Fixed buyer policy for this scenario
const policy: BuyerPolicy = {
  budgetMinor: budgetMinor,
  quantity: 1,
  requiredAttributes: {},
  allowCrossSell: true,
  allowUpsell: true,
  maxCounterAttempts: 2,
  acceptableMaxMinor: 6000000 // Will tolerate up to ₹60,000 before completely walking away, but will counter for budget.
};

async function run() {
  console.log(`🤖 Buyer Agent Initialized`);
  console.log(`   - Objective: "${requestText}"`);
  console.log(`   - Budget: ₹${policy.budgetMinor / 100}`);
  console.log('────────────────────────────────────────────────────────');

  // Load Merchant ID
  let merchantId: string;
  try {
    merchantId = (await fs.readFile('.demo-merchant-id', 'utf-8')).trim();
  } catch (err) {
    console.error('❌ Could not find .demo-merchant-id. Have you run `npm run provision-demo-merchant`?');
    process.exit(1);
  }

  const buyerId = 'buyer_' + Date.now().toString(36);
  const sessionId = 'session_' + Date.now().toString(36);
  const client = new CommerceClient(API_URL, buyerId);

  try {
    console.log(`\n💬 Sending request to Merchant Agent...`);
    const response = await client.sendRequest(requestText, merchantId, sessionId);
    console.log('[DEBUG] Raw response:', JSON.stringify(response, null, 2));

    let currentOffer: any = null;
    let attemptCount = 0;
    let finalEvaluation: any = null;

    if (scenario === 'cross-sell' && !response.order && !response.offer) {
      console.log(`Merchant Agent replied: ${response.merchantResponse || 'No offer generated.'}`);
      console.log(`\n💬 Sending second request to Merchant Agent (accepting cross-sell)...`);
      const secondRequestText = 'Yes, that accessory sounds great. Please add the Premium Leather Laptop Bag to my order and create the checkout.';
      const secondResponse = await client.sendRequest(secondRequestText, merchantId, sessionId);
      
      console.log('[DEBUG] Raw second response:', JSON.stringify(secondResponse, null, 2));

      if (secondResponse.order) {
        response.order = secondResponse.order;
      } else if (secondResponse.offer) {
        response.offer = secondResponse.offer;
      } else {
        console.log(`Merchant Agent replied: ${secondResponse.merchantResponse || 'No offer generated.'}`);
        console.log('❌ Protocol failed to generate an offer or order after 2 turns.');
        return;
      }
    } else if (!response.order && !response.offer) {
      console.log(`Merchant Agent replied: ${response.merchantResponse || 'No offer generated.'}`);
      console.log('❌ Protocol failed to generate an offer or order on turn 1.');
      return;
    }

    if (response.order) {
      const checkoutData = response.order.checkoutData || response.order;
      console.log(`\n✅ Merchant Agent created an Order immediately!`);
      console.log(`   Order ID: ${checkoutData.orderId}`);
      console.log(`   Payment Link: ${checkoutData.paymentLinkUrl || checkoutData.paymentUrl}`);
      console.log(`   Total Amount: ₹${(checkoutData.amountMinor || checkoutData.totalAmountMinor) / 100}`);
      
      // Assume accepted
      finalEvaluation = { action: 'ACCEPT' };
      currentOffer = { totalMinor: checkoutData.amountMinor || checkoutData.totalAmountMinor };
    } else if (response.offer) {
      console.log(`\n✅ Received Offer (${response.offer.id})`);
      console.log(`   Status: ${response.offer.status}`);
      console.log(`   Items:`);
      response.offer.items.forEach((item: any) => {
        console.log(`     - ${item.productId} (x${item.quantity}) - ₹${item.priceMinor / 100}`);
      });

      currentOffer = response.offer;
      
      while (attemptCount <= policy.maxCounterAttempts) {
        finalEvaluation = evaluateOffer(currentOffer, policy, attemptCount);

        if (finalEvaluation.action === 'ACCEPT') {
          console.log(`\n🤝 Offer accepted by Buyer Agent!`);
          break;
        } else if (finalEvaluation.action === 'COUNTER') {
          attemptCount++;
          console.log(`\n💬 Sending Counter Offer for ₹${finalEvaluation.targetTotalMinor / 100}...`);
          
          const counterRes = await client.counterOffer(currentOffer.id, finalEvaluation.targetTotalMinor);
          currentOffer = counterRes;
          
          console.log(`\n✅ Received Counter Response (${currentOffer.status})`);
          console.log(`   New Total: ₹${currentOffer.totalMinor / 100}`);
        } else {
          console.log(`\n🛑 Offer Rejected by Buyer Agent: ${finalEvaluation.reason}`);
          return;
        }
      }

      if (finalEvaluation?.action === 'ACCEPT') {
        console.log(`\n💳 Proceeding to Accept and Pay...`);
        const acceptRes = await client.acceptOffer(currentOffer.id);
        console.log(`\n🎉 SUCCESS!`);
        console.log(`   Order ID: ${acceptRes.orderId}`);
        console.log(`   Payment Link: ${acceptRes.paymentUrl}`);
      }
    } else {
      console.log(`Merchant Agent replied: ${response.merchantResponse || 'No offer generated.'}`);
      console.log('❌ Protocol failed to generate an offer or order.');
      return;
    }

    if (finalEvaluation?.action === 'ACCEPT') {
      console.log('\n────────────────────────────────────────────────────────');
      console.log('📜 AUDIT TIMELINE (Fetched from Merchant Dashboard API)');
      console.log('────────────────────────────────────────────────────────');
      
      const auditLog = await client.getAuditLog(merchantId, sessionId);
      
      // Calculate AI incremental revenue
      const baseRevenue = auditLog.some((l: any) => l.action === 'REVENUE_OPPORTUNITY_DETECTED') 
        ? currentOffer.totalMinor - 450000 // Approximate based on demo accessories
        : currentOffer.totalMinor;
      
      const incremental = currentOffer.totalMinor - baseRevenue;

      console.log(`\nMERCHANT AI GROWTH`);
      console.log(`Revenue                  ₹${currentOffer.totalMinor / 100}`);
      console.log(`Base Revenue             ₹${baseRevenue / 100}`);
      console.log(`AI Incremental Revenue   ₹${incremental / 100}\n`);

      auditLog.forEach((log: any) => {
        const time = new Date(log.timestamp || log.createdAt).toLocaleString();
        console.log(`${time.padEnd(20)} | ${log.action.padEnd(28)} | ${log.reasoning}`);
      });
      console.log('────────────────────────────────────────────────────────');
    }

  } catch (error: any) {
    console.error(`\n❌ Buyer Agent Error: ${error.message}`);
  }
}

run();
