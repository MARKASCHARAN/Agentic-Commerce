import { z } from 'zod';
import { Tool } from '../types';
import { CatalogProvider, InventoryProvider } from '../../../catalog/types';

export const createCatalogSearchTool = (catalogProvider: CatalogProvider): Tool<z.infer<typeof searchSchema>, any> => {
  const searchSchema = z.object({
    query: z.string().describe('The search query for products'),
  });

  return {
    metadata: {
      id: 'catalog.search' as any,
      name: 'Search Catalog',
      description: 'Search for products in the merchant catalog',
      version: '1.0.0'
    },
    inputSchema: searchSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['catalog.search'],
    policy: { id: 'catalog-policy' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to search catalog');
        }
        
        const products = await catalogProvider.search(context.merchantId, input.query);
        return {
          status: 'success',
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            priceMinor: p.priceMinor,
            currency: p.currency,
          }))
        };
      }
    }
  };
};

export const createCatalogGetTool = (catalogProvider: CatalogProvider, inventoryProvider: InventoryProvider): Tool<z.infer<typeof getSchema>, any> => {
  const getSchema = z.object({
    productId: z.string().describe('The ID of the product to retrieve'),
  });

  return {
    metadata: {
      id: 'catalog.get' as any,
      name: 'Get Product',
      description: 'Get detailed information about a specific product including inventory',
      version: '1.0.0'
    },
    inputSchema: getSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['catalog.get'],
    policy: { id: 'catalog-policy' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to get a product');
        }
        
        const product = await catalogProvider.get(context.merchantId, input.productId);
        if (!product) {
          return { status: 'not_found' };
        }

        const inventory = await inventoryProvider.check(context.merchantId, input.productId);

        return {
          status: 'success',
          product: {
            id: product.id,
            name: product.name,
            description: product.description,
            priceMinor: product.priceMinor,
            currency: product.currency,
            inventory: inventory?.quantity ?? 0
          }
        };
      }
    }
  };
};

export const createInventoryCheckTool = (inventoryProvider: InventoryProvider): Tool<z.infer<typeof checkSchema>, any> => {
  const checkSchema = z.object({
    productId: z.string().describe('The ID of the product to check inventory for'),
  });

  return {
    metadata: {
      id: 'inventory.check' as any,
      name: 'Check Inventory',
      description: 'Check available inventory/stock for a specific product',
      version: '1.0.0'
    },
    inputSchema: checkSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['inventory.check'],
    policy: { id: 'catalog-policy' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to check inventory');
        }
        const inventory = await inventoryProvider.check(context.merchantId, input.productId);
        return {
          status: 'success',
          productId: input.productId,
          quantity: inventory?.quantity ?? 0
        };
      }
    }
  };
};

export const createInventoryReserveTool = (prisma: any): Tool<z.infer<typeof reserveSchema>, any> => {
  const reserveSchema = z.object({
    productId: z.string().describe('The ID of the product to reserve'),
    quantity: z.number().int().positive().describe('The quantity to reserve'),
  });

  return {
    metadata: {
      id: 'inventory.reserve' as any,
      name: 'Reserve Inventory',
      description: 'Reserves a specific quantity of a product by decrementing stock',
      version: '1.0.0'
    },
    inputSchema: reserveSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['inventory.reserve'],
    policy: { id: 'catalog-policy' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to reserve inventory');
        }

        return await prisma.$transaction(async (tx: any) => {
          const inventory = await tx.inventory.findUnique({
            where: { productId: input.productId }
          });

          if (!inventory || inventory.merchantId !== context.merchantId) {
            throw new Error(`Product ${input.productId} inventory not found for this merchant`);
          }

          if (inventory.quantity < input.quantity) {
            throw new Error(`Insufficient inventory: requested ${input.quantity}, available ${inventory.quantity}`);
          }

          const updated = await tx.inventory.update({
            where: { productId: input.productId },
            data: {
              quantity: {
                decrement: input.quantity
              }
            }
          });

          return {
            status: 'success',
            productId: input.productId,
            reservedQuantity: input.quantity,
            remainingQuantity: updated.quantity
          };
        });
      }
    }
  };
};
