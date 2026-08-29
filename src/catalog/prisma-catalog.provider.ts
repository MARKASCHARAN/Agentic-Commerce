import { PrismaClient } from '@prisma/client';
import { CatalogProvider, InventoryProvider, CatalogItem, InventoryItem } from './types';

export class PrismaCatalogProvider implements CatalogProvider, InventoryProvider {
  constructor(private readonly prisma: PrismaClient) {}

  async search(merchantId: string, query: string): Promise<CatalogItem[]> {
    const products = await this.prisma.product.findMany({
      where: {
        merchantId,
        active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20
    });

    return products;
  }

  async get(merchantId: string, productId: string): Promise<CatalogItem | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || product.merchantId !== merchantId || !product.active) {
      return null;
    }

    return product;
  }

  async check(merchantId: string, productId: string): Promise<InventoryItem | null> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId }
    });

    if (!inventory || inventory.merchantId !== merchantId) {
      return null;
    }

    return {
      productId: inventory.productId,
      quantity: inventory.quantity
    };
  }
}
