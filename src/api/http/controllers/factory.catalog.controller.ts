import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryCatalogController {
  
  static async listProducts(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
      const page = parseInt((req.query.page as string) || '1', 10);
      const pageSize = parseInt((req.query.pageSize as string) || '25', 10);
      const search = req.query.search as string | undefined;

      const where: any = { merchantId };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: { inventory: true },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.product.count({ where })
      ]);

      res.json({ products, total, page, pageSize });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
      const productId = req.params.productId as string;
      const product = await prisma.product.findUnique({
        where: { id: productId, merchantId },
        include: { inventory: true }
      });
      
      if (!product) {
        res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }});
        return;
      }
      
      res.json({ product });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const data = req.body;
      const qtyRaw = data.inventoryQuantity !== undefined ? data.inventoryQuantity : data.quantity;
      const qty = qtyRaw !== undefined ? parseInt(qtyRaw, 10) : 50;

      const product = await prisma.product.create({
        data: {
          merchantId,
          name: data.name,
          description: data.description,
          type: data.type || 'PHYSICAL',
          priceMinor: data.priceMinor,
          currency: data.currency || 'INR',
          active: data.active !== false,
          metadata: data.metadata,
          inventory: {
            create: { quantity: isNaN(qty) ? 50 : qty, merchantId }
          }
        },
        include: { inventory: true }
      });

      res.status(201).json({ product });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
      const productId = req.params.productId as string;
      const data = req.body;
      const qtyRaw = data.inventoryQuantity !== undefined ? data.inventoryQuantity : data.quantity;
      const qty = qtyRaw !== undefined ? parseInt(qtyRaw, 10) : undefined;
      
      const product = await prisma.product.update({
        where: { id: productId },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          priceMinor: data.priceMinor,
          currency: data.currency,
          active: data.active,
          metadata: data.metadata,
          inventory: qty !== undefined && !isNaN(qty) ? {
            upsert: {
              create: { merchantId, quantity: qty },
              update: { quantity: qty }
            }
          } : undefined
        },
        include: { inventory: true }
      });
      
      res.json({ product });
    } catch (e: any) {
      if (e.code === 'P2025') {
        res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }});
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }
  
  static async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
      const productId = req.params.productId as string;
      
      await prisma.$transaction(async (tx) => {
        await tx.inventory.deleteMany({ where: { productId, merchantId } });
        await tx.product.delete({ where: { id: productId, merchantId } });
      });
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Cannot delete product.' }});
    }
  }
}
