import { z } from 'zod';
import { Tool } from '../types';
import { CatalogProvider, InventoryProvider } from '../../../catalog/types';
import { PaymentProvider } from '../../payments';
import { PrismaClient } from '@prisma/client';
import { getOrCreateCart, acceptOpportunity, rejectOpportunity } from '../../cart/cart-state';
import { PrismaCatalogProvider } from '../../../catalog/prisma-catalog.provider';

export const createCheckoutTool = (
  catalogProvider: CatalogProvider,
  inventoryProvider: InventoryProvider,
  paymentProvider: PaymentProvider,
  prisma: PrismaClient
): Tool<z.infer<typeof checkoutSchema>, any> => {
  const checkoutSchema = z.object({
    productId: z.string().optional().nullable().describe('The ID of the product to checkout'),
    quantity: z.number().int().positive().optional().nullable().describe('The quantity of the product to checkout'),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })).optional().nullable().describe('List of items to checkout'),
  });

  return {
    metadata: {
      id: 'checkout.create' as any,
      name: 'Create Checkout',
      description: 'Creates a checkout session and returns a Razorpay Order ID for payment',
      version: '1.0.0'
    },
    inputSchema: checkoutSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['checkout.create'],
    policy: { id: 'financial-policy' },
    idempotency: { required: true, scope: 'checkout' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to create a checkout');
        }

        // 1. Fetch or initialize the authoritative database Cart
        const defaultItems = (context.cartProductIds || []).map((pid: string) => ({ productId: pid, quantity: 1 }));
        const cart = await getOrCreateCart(prisma, context.sessionId, defaultItems);
        const cartItems = cart.items as any[];

        // 2. Fetch proposed opportunities in this session to validate additions
        const proposedOpps = await prisma.revenueOpportunityLog.findMany({
          where: { sessionId: context.sessionId, status: 'PROPOSED' }
        });

        // Determine target items for checkout
        const itemsToProcess = input.items && input.items.length > 0
          ? input.items
          : (input.productId && input.quantity ? [{ productId: input.productId, quantity: input.quantity }] : (cartItems && cartItems.length > 0 ? cartItems : []));

        if (itemsToProcess.length === 0) {
          throw new Error('No items provided for checkout');
        }

        // Find complements dynamically
        const complements = new Set<string>();
        const dynamicProvider = new PrismaCatalogProvider(prisma);
        const currentCartProductIds = cartItems.map(i => i.productId);
        for (const pid of currentCartProductIds) {
          const related = await dynamicProvider.getRelatedProducts(context.merchantId, pid);
          for (const r of related) {
            complements.add(r.id);
          }
        }

        // 3. Authoritative cart validation:
        // Ensure every item is either in the cart already OR is a proposed opportunity we are accepting.
        for (const item of itemsToProcess) {
          const cartItem = cartItems.find(i => i.productId === item.productId);

          // Check if it's the complement product in one of the proposed opportunities
          const oppToAccept = proposedOpps.find(opp => {
            const resourceId = (opp as any).proposedAction?.resourceId || Array.from(complements).find(cid => !currentCartProductIds.includes(cid));
            return resourceId === item.productId;
          });

          if (!cartItem && !oppToAccept) {
            throw new Error(`Security Exception: Unauthorized item injection. Product "${item.productId}" is not in the authorized cart.`);
          }

          if (cartItem) {
            // Validate requested quantity against DB cart quantity
            if (item.quantity !== cartItem.quantity) {
              throw new Error(`Security Exception: Requested quantity (${item.quantity}) does not match authoritative cart quantity (${cartItem.quantity}).`);
            }
          } else if (oppToAccept) {
            // Validate requested quantity against opportunity default quantity (1)
            const expectedQty = 1;
            if (item.quantity !== expectedQty) {
              throw new Error(`Security Exception: Requested quantity (${item.quantity}) for opportunity product "${item.productId}" does not match authorized opportunity quantity (${expectedQty}).`);
            }

            // If it is a proposed opportunity, accept it and add to cart state in the DB
            const resourceId = (oppToAccept as any).proposedAction?.resourceId || item.productId;
            await acceptOpportunity(prisma, context.sessionId, oppToAccept.id, resourceId);
            // Push to local cartItems list since we updated the DB
            cartItems.push({ productId: resourceId, quantity: expectedQty });
          }
        }

        // Handle any proposed opportunities that were NOT included in the checkout items (rejections)
        for (const opp of proposedOpps) {
          const resourceId = (opp as any).proposedAction?.resourceId || Array.from(complements).find(cid => !currentCartProductIds.includes(cid));
          if (!resourceId) {
            throw new Error('Security Exception: Opportunity does not contain an authoritative complement product ID.');
          }
          const isIncluded = itemsToProcess.some(item => item.productId === resourceId);
          if (!isIncluded) {
            await rejectOpportunity(prisma, context.sessionId, opp.id, resourceId);
          }
        }

        // --- Explicit Consent Check ---
        const cartProductIds: string[] = cartItems.map(i => i.productId);
        const hasUnapprovedItems = itemsToProcess.some(item => !cartProductIds.includes(item.productId));

        if (hasUnapprovedItems && context.conversation && context.conversation.messages) {
          const messages = context.conversation.messages;
          const lastUserMsg = messages.slice().reverse().find((m: any) => m.role === 'user');
          if (lastUserMsg) {
            const text = (lastUserMsg.content || '').toLowerCase().trim();
            if (text === 'buy' || text === 'checkout' || text === 'purchase') {
              throw new Error(`Security Exception: The buyer said "${text}". You attempted to silently add a cross-sell item not in their cart. You must ONLY checkout the items they explicitly agreed to or asked for. Please call checkout.create again with ONLY the items in their cart: ${cartProductIds.join(', ')}.`);
            }
          }
        }
        // ------------------------------

        // Calculate total amount deterministically from products/catalog
        let totalAmountMinor = 0;
        let currency = 'INR';
        const orderItemsData = [];

        for (const item of itemsToProcess) {
          const cartItem = cartItems.find(i => i.productId === item.productId);
          const targetQty = cartItem ? cartItem.quantity : 1;

          const product = await catalogProvider.get(context.merchantId, item.productId);
          if (!product) {
            throw new Error(`Product ${item.productId} not found or not active.`);
          }

          let itemPriceMinor = product.priceMinor;
          if (cartItem && typeof cartItem.negotiatedPriceMinor === 'number') {
            if (cartItem.negotiatedPriceMinor < 0 || cartItem.negotiatedPriceMinor > product.priceMinor) {
              throw new Error(`Security Exception: Negotiated price (${cartItem.negotiatedPriceMinor}) is out of safe bounds.`);
            }
            itemPriceMinor = cartItem.negotiatedPriceMinor;
          }

          const inventory = await inventoryProvider.check(context.merchantId, item.productId);
          if (!inventory || inventory.quantity < targetQty) {
            throw new Error(`Insufficient inventory for product ${item.productId}`);
          }

          totalAmountMinor += itemPriceMinor * targetQty;
          currency = product.currency;
          orderItemsData.push({
            productId: product.id,
            quantity: targetQty,
            price: itemPriceMinor / 100,
          });
        }

        // 4. Duplicate Order Protection & Reuse logic:
        // Find existing CommerceOrder in 'created' status for this session.
        let order = await prisma.commerceOrder.findFirst({
          where: { sessionId: context.sessionId, status: 'created' },
          include: { items: true }
        });

        let isMatch = false;
        if (order) {
          // Verify if the existing order's items match itemsToProcess exactly
          if (order.items.length === itemsToProcess.length) {
            isMatch = order.items.every(dbItem => {
              const reqItem = itemsToProcess.find(ri => ri.productId === dbItem.productId);
              return reqItem && reqItem.quantity === dbItem.quantity;
            });
          }
        }

        if (order && !isMatch) {
          // Cart has changed, so delete old created order and payment intent to create fresh ones
          await prisma.commerceItem.deleteMany({ where: { orderId: order.id } });
          await prisma.paymentIntent.deleteMany({ where: { orderId: order.id } });
          await prisma.commerceOrder.delete({ where: { id: order.id } });
          order = null;
        }

        if (!order) {
          order = await prisma.commerceOrder.create({
            data: {
              merchantId: context.merchantId,
              sessionId: context.sessionId,
              total: totalAmountMinor / 100,
              status: 'created',
              items: {
                create: orderItemsData
              }
            },
            include: { items: true }
          });
        }

        if (!order) {
          throw new Error('Failed to create or retrieve CommerceOrder');
        }

        // Call Provider to create Razorpay order (idempotency key ensures provider-side idempotency)
        const providerOrder = await paymentProvider.createOrder({
          amount: totalAmountMinor,
          currency: currency,
          receipt: order.id,
          notes: {
            sessionId: context.sessionId,
            merchantId: context.merchantId,
            receipt: order.id
          }
        }, context.idempotencyKey);

        if (!providerOrder.success || !providerOrder.data) {
          throw new Error('Failed to create Razorpay Order');
        }

        const razorpayOrderId = providerOrder.data.providerId;

        // Fetch or create the associated internal PaymentIntent
        let paymentIntent = await prisma.paymentIntent.findFirst({
          where: { orderId: order.id }
        });

        if (!paymentIntent) {
          paymentIntent = await prisma.paymentIntent.create({
            data: {
              orderId: order.id,
              amount: totalAmountMinor,
              status: 'created',
              idempotency_key: context.idempotencyKey || `checkout_${order.id}`,
            }
          });
        }

        // Connect the accepted opportunities to the order and payment details
        const acceptedOpps = await prisma.revenueOpportunityLog.findMany({
          where: {
            sessionId: context.sessionId,
            status: 'ACCEPTED',
            orderId: null
          }
        });
        for (const opp of acceptedOpps) {
          const resourceId = (opp as any).proposedAction?.resourceId || Array.from(complements).find(cid => !currentCartProductIds.includes(cid));
          
          let isAcceptedInOrder = false;
          if (resourceId) {
             isAcceptedInOrder = orderItemsData.some(item => item.productId === resourceId);
          } else {
             const cartAccepted = new Set(cart.acceptedOpportunities as string[]);
             if (cartAccepted.has(opp.id)) {
                 isAcceptedInOrder = orderItemsData.some(item => cartAccepted.has(item.productId));
             }
          }

          if (!resourceId && !isAcceptedInOrder) {
            throw new Error('Security Exception: Opportunity does not contain an authoritative complement product ID.');
          }

          if (isAcceptedInOrder) {
            await prisma.revenueOpportunityLog.update({
              where: { id: opp.id },
              data: {
                orderId: order.id,
                paymentIntentId: paymentIntent.id,
                updatedAt: new Date()
              }
            });
          }
        }

        return {
          status: 'success',
          checkoutData: {
            orderId: order.id,
            razorpayOrderId,
            amountMinor: totalAmountMinor,
            currency: currency,
          }
        };
      }
    }
  };
};
