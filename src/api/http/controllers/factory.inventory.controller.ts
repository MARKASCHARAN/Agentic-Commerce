import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryInventoryController {
  
  static async getInventory(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
      const inventory = await prisma.inventory.findMany({
        where: { merchantId },
        include: { product: true }
      });
      res.json({ inventory });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async updateInventory(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
      const productId = req.params.productId as string;
      const { operation, quantity } = req.body;

      if (!['set', 'increment', 'decrement'].includes(operation)) {
        res.status(400).json({ error: { code: 'INVALID_OPERATION', message: 'Operation must be set, increment, or decrement' }});
        return;
      }

      if (typeof quantity !== 'number' || quantity < 0) {
        res.status(400).json({ error: { code: 'INVALID_QUANTITY', message: 'Quantity must be a positive number' }});
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: { productId }
        });

        if (!inventory) {
          if (operation === 'decrement') {
            throw new Error('Cannot decrement non-existent inventory');
          }
          return await tx.inventory.create({
            data: {
              productId,
              merchantId,
              quantity: operation === 'set' || operation === 'increment' ? quantity : 0
            }
          });
        }

        if (inventory.merchantId !== merchantId) {
          throw new Error('Inventory mismatch');
        }

        let newQuantity = inventory.quantity;
        if (operation === 'set') newQuantity = quantity;
        else if (operation === 'increment') newQuantity += quantity;
        else if (operation === 'decrement') newQuantity = Math.max(0, newQuantity - quantity);

        return await tx.inventory.update({
          where: { productId },
          data: { quantity: newQuantity }
        });
      });

      res.json({ inventory: updated });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }
}
