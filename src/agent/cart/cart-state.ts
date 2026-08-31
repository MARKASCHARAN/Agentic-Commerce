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
    await prisma.session.upsert({
      where: { id: sessionId },
      update: {},
      create: { id: sessionId }
    });
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
  return await prisma.$transaction(async (tx) => {
    // 1. Update the RevenueOpportunityLog if it exists and is PROPOSED
    const result = await tx.revenueOpportunityLog.updateMany({
      where: { id: opportunityId, status: 'PROPOSED', sessionId },
      data: { status: 'REJECTED', updatedAt: new Date() }
    });

    if (result.count === 0) {
      // It's possible it was already rejected/accepted, or belongs to another session.
      // We don't necessarily need to throw an error for reject (idempotent skip is fine),
      // but to be strictly deterministic we log or just return.
      return null;
    }

    // 2. Add to rejectedOpportunities list in the Cart
    const cart = await getOrCreateCart(tx as PrismaClient, sessionId);
    const rejected = new Set(cart.rejectedOpportunities);
    rejected.add(productId);
    rejected.add(opportunityId);

    return await tx.cart.update({
      where: { sessionId },
      data: {
        rejectedOpportunities: Array.from(rejected),
        updatedAt: new Date()
      }
    });
  });
}

export async function acceptOpportunity(
  prisma: PrismaClient,
  sessionId: string,
  opportunityId: string,
  productId: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Update the RevenueOpportunityLog if it is PROPOSED
    const result = await tx.revenueOpportunityLog.updateMany({
      where: { id: opportunityId, status: 'PROPOSED', sessionId },
      data: { status: 'ACCEPTED', updatedAt: new Date() }
    });

    if (result.count === 0) {
      throw new Error(`Security Exception: Opportunity ${opportunityId} could not be accepted. It may have already been decided, belong to another session, or not exist.`);
    }

    // 2. Add product to Cart items and opportunityId to acceptedOpportunities list
    const cart = await getOrCreateCart(tx as PrismaClient, sessionId);
    
    const items = (cart.items as any[] as CartItem[]).slice();
    if (!items.some(i => i.productId === productId)) {
      items.push({ productId, quantity: 1 });
    }

    const accepted = new Set(cart.acceptedOpportunities);
    accepted.add(productId);
    accepted.add(opportunityId);

    return await tx.cart.update({
      where: { sessionId },
      data: {
        items: items as any,
        acceptedOpportunities: Array.from(accepted),
        updatedAt: new Date()
      }
    });
  });
}
