import { PrismaClient } from '@prisma/client';

export interface CartItem {
  productId: string;
  quantity: number;
}

export async function getOrCreateCart(
  prisma: PrismaClient,
  sessionId: string,
  defaultItems: CartItem[] = []
) {
  let cart = await prisma.cart.findUnique({
    where: { sessionId }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        sessionId,
        items: defaultItems as any,
        rejectedOpportunities: [],
        acceptedOpportunities: []
      }
    });
  }

  return cart;
}

export async function updateCartItems(
  prisma: PrismaClient,
  sessionId: string,
  items: CartItem[]
) {
  return await prisma.cart.update({
    where: { sessionId },
    data: {
      items: items as any,
      updatedAt: new Date()
    }
  });
}

export async function rejectOpportunity(
  prisma: PrismaClient,
  sessionId: string,
  opportunityId: string,
  productId: string
) {
  // 1. Update the RevenueOpportunityLog if it exists
  await prisma.revenueOpportunityLog.updateMany({
    where: { id: opportunityId, status: 'PROPOSED' },
    data: { status: 'REJECTED', updatedAt: new Date() }
  });

  // 2. Add to rejectedOpportunities list in the Cart
  const cart = await getOrCreateCart(prisma, sessionId);
  const rejected = new Set(cart.rejectedOpportunities);
  rejected.add(productId);
  rejected.add(opportunityId);

  return await prisma.cart.update({
    where: { sessionId },
    data: {
      rejectedOpportunities: Array.from(rejected),
      updatedAt: new Date()
    }
  });
}

export async function acceptOpportunity(
  prisma: PrismaClient,
  sessionId: string,
  opportunityId: string,
  productId: string
) {
  // 1. Update the RevenueOpportunityLog if it exists
  await prisma.revenueOpportunityLog.updateMany({
    where: { id: opportunityId, status: 'PROPOSED' },
    data: { status: 'ACCEPTED', updatedAt: new Date() }
  });

  // 2. Add product to Cart items and opportunityId to acceptedOpportunities list
  const cart = await getOrCreateCart(prisma, sessionId);
  
  const items = (cart.items as any[] as CartItem[]).slice();
  if (!items.some(i => i.productId === productId)) {
    items.push({ productId, quantity: 1 });
  }

  const accepted = new Set(cart.acceptedOpportunities);
  accepted.add(productId);
  accepted.add(opportunityId);

  return await prisma.cart.update({
    where: { sessionId },
    data: {
      items: items as any,
      acceptedOpportunities: Array.from(accepted),
      updatedAt: new Date()
    }
  });
}
