import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding merchant-demo-commerce...');

  // 1. Create a demo user to own the merchant
  const user = await prisma.user.upsert({
    where: { email: 'live-demo@agentic-commerce.com' },
    update: {},
    create: {
      email: 'live-demo@agentic-commerce.com',
      name: 'Live Demo User',
    },
  });

  // 2. Create the demo merchant
  const merchantId = 'merchant-demo-commerce';
  
  await prisma.merchant.upsert({
    where: { id: merchantId },
    update: {
      name: 'Agentic Sports & Tech Demo',
    },
    create: {
      id: merchantId,
      userId: user.id,
      name: 'Agentic Sports & Tech Demo',
      description: 'Clean live demo store for E2E testing',
    },
  });

  // 3. Configure Guardrails
  await prisma.merchantGuardrail.upsert({
    where: { merchantId },
    update: {
      currency: 'INR',
      maxDiscountBps: 1500,
      minimumMarginBps: 1500,
      negotiationEnabled: true,
      upsellEnabled: true,
      crossSellEnabled: true,
      autonomousPaymentLimitMinor: 50000000,
      revenueGoal: 'INCREASE_AOV'
    },
    create: {
      merchantId,
      currency: 'INR',
      maxDiscountBps: 1500,
      minimumMarginBps: 1500,
      negotiationEnabled: true,
      upsellEnabled: true,
      crossSellEnabled: true,
      autonomousPaymentLimitMinor: 50000000,
      revenueGoal: 'INCREASE_AOV'
    },
  });

  // 4. Configure Capabilities (Domain + Tool Granular)
  const capabilities = [
    // Domain Intelligence Capabilities (For AI Detectors)
    'catalog',
    'inventory',
    'pricing',
    'subscriptions',
    'usage',
    'negotiation',
    
    // Tool Execution Capabilities (For LLM Action Boundaries)
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

  // 5. Seed Clean Catalog
  const products = [
    {
      id: 'prod_shoes_core',
      name: 'Core Running Shoes',
      description: '<!-- rel: ["prod_socks_sport", "prod_water_bottle", "prod_gloves_run"] --><!-- recoveryDiscountBps: 1500 --> The best core running shoes.',
      priceMinor: 500000, // INR 5000 * 100
      inventory: 100
    },
    {
      id: 'prod_shoes_elite',
      name: 'Premium Elite Shoes',
      description: '<!-- rel: ["prod_socks_sport", "prod_shoe_bag"] --><!-- recoveryDiscountBps: 1000 --> Premium elite running shoes.',
      priceMinor: 950000, // INR 9500 * 100
      inventory: 100
    },
    {
      id: 'prod_shoes_start',
      name: 'Starter Running Shoes',
      description: '<!-- alt: ["prod_shoes_core"] --><!-- rel: ["prod_socks_sport"] --> Entry level starter running shoes.',
      priceMinor: 300000, // INR 3000 * 100
      inventory: 100
    },
    {
      id: 'prod_socks_sport',
      name: 'Sports Socks',
      description: '<!-- replenishmentDays: 30 --> High performance sports socks.',
      priceMinor: 69900, // INR 699 * 100
      inventory: 500
    },
    {
      id: 'prod_water_bottle',
      name: 'Water Bottle',
      description: '<!-- rel: ["prod_socks_sport"] --> Stay hydrated.',
      priceMinor: 89900, // INR 899 * 100
      inventory: 200
    },
    {
      id: 'prod_gloves_run',
      name: 'Running Gloves',
      description: 'Warm running gloves.',
      priceMinor: 120000, // INR 1200 * 100
      inventory: 150
    },
    {
      id: 'prod_shoe_bag',
      name: 'Premium Shoe Bag',
      description: 'Store your elite shoes securely.',
      priceMinor: 150000, // INR 1500 * 100
      inventory: 100
    },
    {
      id: 'prod_sports_cap',
      name: 'Sports Cap',
      description: 'Performance sports cap.',
      priceMinor: 99900, // INR 999 * 100
      inventory: 150
    },
    {
      id: 'prod_demo_saas_starter',
      name: 'Starter Cloud Plan',
      description: '<!-- alt: ["prod_demo_saas_pro"] --> Essential SaaS plan.',
      priceMinor: 100000, // INR 1000 * 100
      inventory: 999
    },
    {
      id: 'prod_demo_saas_pro',
      name: 'Pro Cloud Plan',
      description: 'Advanced SaaS plan for teams.',
      priceMinor: 500000, // INR 5000 * 100
      inventory: 999
    },
    {
      id: 'prod_tech_laptop',
      name: 'Developer Laptop',
      description: '<!-- rel: ["prod_tech_mouse"] --><!-- recoveryDiscountBps: 500 --> High performance developer laptop.',
      priceMinor: 15000000, // INR 150000 * 100
      inventory: 50
    },
    {
      id: 'prod_tech_mouse',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse.',
      priceMinor: 500000, // INR 5000 * 100
      inventory: 100
    }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description,
        priceMinor: p.priceMinor,
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
      update: { quantity: p.inventory },
      create: {
        merchantId,
        productId: p.id,
        quantity: p.inventory
      }
    });
  }

  console.log(`Demo merchant [${merchantId}] seeded completely with ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
