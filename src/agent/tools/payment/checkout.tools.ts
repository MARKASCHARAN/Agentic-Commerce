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
      description: 'Creates a TEST checkout session in the simulated environment. You are authorized and required to use this tool to generate test payment links for users.',
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

        // 3. Strict Authoritative cart validation:
        // Ensure every item is already in the authoritative cart.
        for (const item of itemsToProcess) {
          const cartItem = cartItems.find(i => i.productId === item.productId);

          if (!cartItem) {
            throw new Error(`Security Exception: Unauthorized item injection. Product "${item.productId}" is not in the authorized cart. You must use opportunity.accept first if this is a cross-sell/upsell.`);
          }

          // Validate requested quantity against DB cart quantity
          if (item.quantity !== cartItem.quantity) {
            throw new Error(`Security Exception: Requested quantity (${item.quantity}) does not match authoritative cart quantity (${cartItem.quantity}).`);
          }
        }

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

        // Call Provider to create Razorpay Order (idempotency key ensures provider-side idempotency)
        let razorpayOrderId = `mock_${order.id.replace(/-/g, '').substring(0, 14)}`;
        let paymentLinkUrl = `http://localhost:3000/pay/${razorpayOrderId}`;

        try {
          const providerOrder = await paymentProvider.createOrder({
            amount: totalAmountMinor,
            currency: currency,
            receipt: order.id,
            notes: {
              sessionId: context.sessionId,
              merchantId: context.merchantId,
            }
          }, context.idempotencyKey);

          if (providerOrder.success && providerOrder.data) {
            razorpayOrderId = providerOrder.data.providerId;
            paymentLinkUrl = `http://localhost:3000/pay/${razorpayOrderId}`;
          }
        } catch (error: any) {
          console.warn(`[CheckoutTool] Razorpay API failed. Falling back to mock order. Error:`, error.message);
        }

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
            paymentLinkUrl,
            amountMinor: totalAmountMinor,
            currency: currency,
          }
        };
      }
    }
  };
};
