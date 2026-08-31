import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOWED_CAPABILITIES = ['catalog', 'inventory', 'pricing', 'negotiation', 'checkout'];

const SKILL_PREREQUISITES: Record<string, string[]> = {
  'crossSell': ['catalog', 'inventory'],
  'upsell': ['catalog', 'inventory'],
  'recovery': [],
  'repeatPurchase': [],
  'productSearch': ['catalog']
};

export class FactoryController {
  static async provisionMerchant(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      const merchantId = 'merchant_fac_' + Date.now().toString(36);
      const userId = 'user_fac_' + Date.now().toString(36);

      const requestedCapabilities = data.capabilities || [];
      const validCapabilities = requestedCapabilities.filter((cap: string) => ALLOWED_CAPABILITIES.includes(cap));

      const requestedSkills = data.skills || {};
      const validSkills: Record<string, boolean> = {};
      for (const [skill, enabled] of Object.entries(requestedSkills)) {
        if (enabled) {
          const prerequisites = SKILL_PREREQUISITES[skill] || [];
          const hasPrerequisites = prerequisites.every(prereq => validCapabilities.includes(prereq));
          validSkills[skill] = hasPrerequisites;
        }
      }

      const businessType = data.businessType || 'retail';

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            email: `${merchantId}@factory.example.com`,
            name: data.name || 'Factory Merchant'
          }
        });

        await tx.merchant.create({
          data: {
            id: merchantId,
            name: data.name || 'Factory Merchant',
            userId: userId
          }
        });

        const strategyPrimary = data.revenueStrategy?.primary || 'REVENUE';
        const strategySecondary = data.revenueStrategy?.secondary || [];
        await tx.merchantStrategy.create({
          data: {
            merchantId: merchantId,
            primary: strategyPrimary,
            secondary: strategySecondary
          }
        });

        await tx.merchantGuardrail.create({
          data: {
            merchantId: merchantId,
            businessType: businessType,
            maxDiscountBps: data.pricing?.maxDiscountBps || 0,
            minimumMarginBps: data.pricing?.minimumMarginBps || 0,
            negotiationEnabled: data.negotiation?.enabled || false,
            maxNegotiationRounds: data.negotiation?.maxRounds || 4,
            upsellEnabled: validSkills['upsell'] || false,
            crossSellEnabled: validSkills['crossSell'] || false,
            autonomousPaymentLimitMinor: data.autonomy?.autoApproveBelowMinor || 0,
            approvalAboveMinor: data.autonomy?.humanApprovalAboveMinor || 0
          }
        });

        for (const cap of validCapabilities) {
          await tx.merchantCapability.create({
            data: {
              merchantId,
              capability: cap
            }
          });
        }
      });

      res.json({
        merchantId,
        status: 'ACTIVE',
        provisionedCapabilities: validCapabilities,
        provisionedSkills: validSkills
      });

    } catch (error: any) {
      console.error('[Factory Error]', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async uploadCatalog(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { products } = req.body;

      if (!Array.isArray(products)) {
        res.status(400).json({ error: 'Expected products array' });
        return;
      }

      const mapping: any[] = [];
      await prisma.$transaction(async (tx) => {
        for (const p of products) {
          const product = await tx.product.create({
            data: {
              merchantId,
              name: p.name,
              description: p.description,
              priceMinor: p.priceMinor,
              currency: p.currency || 'INR',
              active: p.active !== false
            }
          });
          mapping.push({ externalId: p.externalId, productId: product.id });
        }
      });

      res.json({
        created: mapping.length,
        products: mapping
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateInventory(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        res.status(400).json({ error: 'Expected items array' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.inventory.upsert({
            where: { productId: item.productId },
            update: { quantity: item.quantity },
            create: {
              merchantId,
              productId: item.productId,
              quantity: item.quantity
            }
          });
        }
      });

      res.json({ status: 'ok', updated: items.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
