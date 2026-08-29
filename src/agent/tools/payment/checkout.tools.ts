import { z } from 'zod';
import { Tool } from '../types';
import { CatalogProvider, InventoryProvider } from '../../../catalog/types';
import { PaymentProvider } from '../../payments';
import { PrismaClient } from '@prisma/client';

export const createCheckoutTool = (
  catalogProvider: CatalogProvider, 
  inventoryProvider: InventoryProvider,
  paymentProvider: PaymentProvider,
  prisma: PrismaClient
): Tool<z.infer<typeof checkoutSchema>, any> => {
  const checkoutSchema = z.object({
    productId: z.string().describe('The ID of the product to checkout'),
    quantity: z.number().int().positive().describe('The quantity of the product to checkout'),
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

        const product = await catalogProvider.get(context.merchantId, input.productId);
        if (!product) {
          throw new Error(`Product ${input.productId} not found or not active.`);
        }

        const inventory = await inventoryProvider.check(context.merchantId, input.productId);
        if (!inventory || inventory.quantity < input.quantity) {
          throw new Error(`Insufficient inventory for product ${input.productId}`);
        }

        const totalAmountMinor = product.priceMinor * input.quantity;

        // Create the internal CommerceOrder
        const order = await prisma.commerceOrder.create({
          data: {
            merchantId: context.merchantId,
            sessionId: context.sessionId,
            total: totalAmountMinor / 100, // Storing major units for legacy compatibility if required
            status: 'created',
            items: {
              create: [
                {
                  productId: product.id,
                  quantity: input.quantity,
                  price: product.priceMinor / 100,
                }
              ]
            }
          }
        });

        // Call Provider to create order
        const providerOrder = await paymentProvider.createOrder({
          amount: totalAmountMinor,
          currency: product.currency,
          receipt: order.id,
          notes: {
            sessionId: context.sessionId,
            merchantId: context.merchantId,
            productId: product.id,
          }
        }, context.idempotencyKey);

        if (!providerOrder.success || !providerOrder.data) {
          throw new Error('Failed to create Razorpay Order');
        }

        const razorpayOrderId = providerOrder.data.providerId;

        // Create the internal PaymentIntent
        await prisma.paymentIntent.create({
          data: {
            orderId: order.id,
            amount: totalAmountMinor,
            status: 'created',
            idempotency_key: context.idempotencyKey || `checkout_${order.id}`,
          }
        });

        return {
          status: 'success',
          checkoutData: {
            orderId: order.id,
            razorpayOrderId,
            amountMinor: totalAmountMinor,
            currency: product.currency,
          }
        };
      }
    }
  };
};
