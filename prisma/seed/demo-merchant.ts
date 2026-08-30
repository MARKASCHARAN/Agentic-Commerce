import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo merchant...');

  // 1. Create a dummy user to own the merchant
  const user = await prisma.user.upsert({
    where: { email: 'demo@agentic-commerce.com' },
    update: {},
    create: {
      email: 'demo@agentic-commerce.com',
      name: 'Demo User',
    },
  });

  // 2. Create the demo merchant
  const merchantId = 'demo-merchant-id';
  
  const merchant = await prisma.merchant.upsert({
    where: { id: merchantId },
    update: {
      name: 'Agentic Sports Demo',
    },
    create: {
      id: merchantId,
      userId: user.id,
      name: 'Agentic Sports Demo',
      description: 'Demo store for E2E testing',
    },
  });

  // 3. Configure Guardrails
  await prisma.merchantGuardrail.upsert({
    where: { merchantId },
    update: {
      currency: 'INR',
      maxDiscountBps: 1000,
      minimumMarginBps: 2000,
      negotiationEnabled: true,
      upsellEnabled: true,
      crossSellEnabled: true,
      autonomousPaymentLimitMinor: 2500000,
      revenueGoal: 'INCREASE_AOV'
    },
    create: {
      merchantId,
      currency: 'INR',
      maxDiscountBps: 1000,
      minimumMarginBps: 2000,
      negotiationEnabled: true,
      upsellEnabled: true,
      crossSellEnabled: true,
      autonomousPaymentLimitMinor: 2500000,
      revenueGoal: 'INCREASE_AOV'
    },
  });

  // 4. Configure Capabilities
  const capabilities = [
    'catalog.search',
    'catalog.get',
    'inventory.check',
    'quote.create',
    'negotiation.create',
    'checkout.create',
    'payment.create'
  ];

  for (const capability of capabilities) {
    await prisma.merchantCapability.upsert({
      where: {
        merchantId_capability: {
          merchantId,
          capability
        }
      },
      update: {},
      create: {
        merchantId,
        capability
      }
    });
  }

  // 5. Seed Catalog & Inventory
  const products = [
    {
      id: 'prod_shoes_01',
      name: 'Running Shoes',
      description: '<!-- rel: ["prod_socks_01"] --> Premium Running Shoes',
      priceMinor: 500000, // INR 5000 * 100
      inventory: 20
    },
    {
      id: 'prod_socks_01',
      name: 'Sports Socks',
      description: 'Premium Sports Socks',
      priceMinor: 69900, // INR 699 * 100
      inventory: 50
    },
    {
      id: 'prod_bag_01',
      name: 'Sports Bag',
      description: 'Premium Sports Bag',
      priceMinor: 200000, // INR 2000 * 100
      inventory: 10
    }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description,
        priceMinor: p.priceMinor,
        currency: 'INR',
        active: true,
      },
      create: {
        id: p.id,
        merchantId,
        name: p.name,
        description: p.description,
        priceMinor: p.priceMinor,
        currency: 'INR',
        active: true,
      }
    });

    await prisma.inventory.upsert({
      where: { productId: p.id },
      update: {
        quantity: p.inventory,
      },
      create: {
        merchantId,
        productId: p.id,
        quantity: p.inventory,
      }
    });
  }

  // --- 6. SEED MERCHANT B: Electronics Store ---
  const electronicsMerchantId = 'merchant-electronics-01';
  await prisma.merchant.upsert({
    where: { id: electronicsMerchantId },
    update: { name: 'Agentic Electronics' },
    create: { id: electronicsMerchantId, userId: user.id, name: 'Agentic Electronics', description: 'Developer Laptops & Accessories' }
  });
  await prisma.merchantGuardrail.upsert({
    where: { merchantId: electronicsMerchantId },
    update: { currency: 'INR', maxDiscountBps: 1500, minimumMarginBps: 2000, negotiationEnabled: true, upsellEnabled: true, crossSellEnabled: true, autonomousPaymentLimitMinor: 5000000, revenueGoal: 'INCREASE_AOV' },
    create: { merchantId: electronicsMerchantId, currency: 'INR', maxDiscountBps: 1500, minimumMarginBps: 2000, negotiationEnabled: true, upsellEnabled: true, crossSellEnabled: true, autonomousPaymentLimitMinor: 5000000, revenueGoal: 'INCREASE_AOV' }
  });
  for (const capability of capabilities) {
    await prisma.merchantCapability.upsert({
      where: { merchantId_capability: { merchantId: electronicsMerchantId, capability } },
      update: {},
      create: { merchantId: electronicsMerchantId, capability }
    });
  }
  const electronicsProducts = [
    { id: 'prod_laptop_01', name: 'Developer Pro Laptop', description: '<!-- rel: ["prod_mouse_01"] --> High performance developer workstation', priceMinor: 12000000, inventory: 15 },
    { id: 'prod_mouse_01', name: 'Wireless Ergonomic Mouse', description: 'Precision wireless ergonomic mouse', priceMinor: 350000, inventory: 40 }
  ];
  for (const p of electronicsProducts) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, priceMinor: p.priceMinor, currency: 'INR', active: true },
      create: { id: p.id, merchantId: electronicsMerchantId, name: p.name, description: p.description, priceMinor: p.priceMinor, currency: 'INR', active: true }
    });
    await prisma.inventory.upsert({
      where: { productId: p.id },
      update: { quantity: p.inventory },
      create: { merchantId: electronicsMerchantId, productId: p.id, quantity: p.inventory }
    });
  }

  // --- 7. SEED MERCHANT C: SaaS Cloud Platform ---
  const saasMerchantId = 'merchant-saas-01';
  await prisma.merchant.upsert({
    where: { id: saasMerchantId },
    update: { name: 'Agentic Cloud SaaS' },
    create: { id: saasMerchantId, userId: user.id, name: 'Agentic Cloud SaaS', description: 'Enterprise Cloud API Infrastructure' }
  });
  await prisma.merchantGuardrail.upsert({
    where: { merchantId: saasMerchantId },
    update: { currency: 'INR', maxDiscountBps: 2000, minimumMarginBps: 1000, negotiationEnabled: true, upsellEnabled: true, crossSellEnabled: true, autonomousPaymentLimitMinor: 10000000, revenueGoal: 'INCREASE_AOV' },
    create: { merchantId: saasMerchantId, currency: 'INR', maxDiscountBps: 2000, minimumMarginBps: 1000, negotiationEnabled: true, upsellEnabled: true, crossSellEnabled: true, autonomousPaymentLimitMinor: 10000000, revenueGoal: 'INCREASE_AOV' }
  });
  for (const capability of capabilities) {
    await prisma.merchantCapability.upsert({
      where: { merchantId_capability: { merchantId: saasMerchantId, capability } },
      update: {},
      create: { merchantId: saasMerchantId, capability }
    });
  }
  const saasProducts = [
    { id: 'prod_saas_starter', name: 'Starter Cloud Plan', description: '<!-- rel: ["prod_saas_pro"] --> Basic cloud hosting & API access', priceMinor: 199900, inventory: 999999 },
    { id: 'prod_saas_pro', name: 'Enterprise Pro Cloud Plan', description: 'Dedicated cloud servers & 24/7 priority support', priceMinor: 999900, inventory: 999999 }
  ];
  for (const p of saasProducts) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, priceMinor: p.priceMinor, currency: 'INR', active: true },
      create: { id: p.id, merchantId: saasMerchantId, name: p.name, description: p.description, priceMinor: p.priceMinor, currency: 'INR', active: true }
    });
    await prisma.inventory.upsert({
      where: { productId: p.id },
      update: { quantity: p.inventory },
      create: { merchantId: saasMerchantId, productId: p.id, quantity: p.inventory }
    });
  }

  console.log('Demo merchants seed complete (Sports, Electronics, SaaS).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
