import fs from 'fs/promises';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function provision() {
  console.log('📦 Provisioning Demo Merchant...');

  // 1. Create Merchant
  const provisionRes = await fetch(`${API_URL}/v1/factory/merchants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Agentic Electronics Demo',
      capabilities: ['catalog', 'inventory', 'pricing', 'negotiation', 'checkout'],
      guardrails: {
        maxDiscountPercentage: 10,
        minMarginPercentage: 15,
        blockedCategories: ['weapons'],
        requireManagerApprovalOverAmount: 500000000, // Very high for demo
        crossSellEnabled: true,
        upsellEnabled: true
      },
      skills: {
        crossSell: true,
        upsell: true
      },
      strategy: {
        primary: 'AOV',
        secondary: ['CONVERSION']
      }
    })
  });

  if (!provisionRes.ok) {
    throw new Error(`Failed to provision merchant: ${await provisionRes.text()}`);
  }

  const { merchantId } = await provisionRes.json();
  console.log(`✅ Merchant created: ${merchantId}`);

  // 2. Ingest Catalog
  const products = [
    {
      id: 'laptop-pro',
      externalId: 'laptop-pro',
      name: 'Laptop Pro 32GB',
      description: 'High performance laptop with 32GB RAM. <!-- rel: ["laptop-bag", "wireless-mouse"] -->',
      priceMinor: 4500000,
      currency: 'INR',
      sku: 'LPT-PRO-32',
      metadata: { category: 'electronics', type: 'laptop', ram: '32GB' }
    },
    {
      id: 'laptop-bag',
      externalId: 'laptop-bag',
      name: 'Premium Leather Laptop Bag',
      description: 'Fits 15-inch laptops comfortably.',
      priceMinor: 250000,
      currency: 'INR',
      sku: 'BAG-LTHR-15',
      metadata: { category: 'accessories', type: 'bag' }
    },
    {
      id: 'wireless-mouse',
      externalId: 'wireless-mouse',
      name: 'Ergonomic Wireless Mouse',
      description: 'Long battery life and ergonomic design.',
      priceMinor: 200000,
      currency: 'INR',
      sku: 'MSE-WRLS-01',
      metadata: { category: 'accessories', type: 'mouse' }
    }
  ];

  console.log('📚 Ingesting Catalog...');
  const catRes = await fetch(`${API_URL}/v1/factory/merchants/${merchantId}/catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products })
  });
  let productMap: Record<string, string> = {};
  if (!catRes.ok) {
    console.error(`Failed to ingest catalog:`, await catRes.text());
  } else {
    const data = await catRes.json();
    for (const m of data.products) {
      if (m.externalId) productMap[m.externalId] = m.productId;
    }
    console.log(`  - Ingested ${products.length} products`);
  }

  // 3. Ingest Inventory
  console.log('📦 Ingesting Inventory...');
  const invRes = await fetch(`${API_URL}/v1/factory/merchants/${merchantId}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: products.map(p => ({
        productId: productMap[p.id],
        quantity: 50
      }))
    })
  });
  if (!invRes.ok) {
    console.error(`Failed to ingest inventory:`, await invRes.text());
  } else {
    console.log(`  - Set 50 units for all products`);
  }

  // 4. Save merchantId to a temporary file for the buyer agent to pick up
  await fs.writeFile('.demo-merchant-id', merchantId, 'utf-8');
  console.log(`\n🎉 Provisioning complete. Merchant ID saved to .demo-merchant-id`);
}

provision().catch(console.error);
