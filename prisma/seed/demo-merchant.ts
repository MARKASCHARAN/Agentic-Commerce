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
      priceMinor: 50000, // INR 500 * 100
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

  console.log('Demo merchant seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
