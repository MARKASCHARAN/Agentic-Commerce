import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';

const prisma = new PrismaClient();

export const searchProductsTool = {
  name: 'merchant.search_products',
  description: 'Search the merchant catalog for products. This returns authoritative product details including IDs and prices. Do not invent prices.\\n\\nOnly report facts returned by the merchant backend. Never infer: warranty, shipping, delivery time, return policy, product quality, availability, taxes, fees, or payment status unless the tool response explicitly provides them.\\n\\n[readOnlyHint: true]',
  schema: {
    query: z.string().describe('Search query for products (e.g., "laptop 32GB").')
  },
  handler: async ({ query }: { query: string }) => {
    try {
      const { merchantId } = getMcpContext();
      
      const products = await prisma.product.findMany({
        where: { 
          merchantId,
          active: true,
          name: { contains: query, mode: 'insensitive' }
        },
        include: { inventory: true },
        take: 10
      });

      const formattedProducts = products.map(p => ({
        productId: p.id,
        name: p.name,
        price: p.priceMinor / 100,
        currency: p.currency,
        availableQuantity: p.inventory?.quantity || 0
      }));

      return {
        content: [{ type: "text", text: JSON.stringify({ products: formattedProducts }, null, 2) }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "CATALOG_ERROR", message: e.message }) }] };
    }
  }
};
