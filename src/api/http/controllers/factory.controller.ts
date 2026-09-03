import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOWED_CAPABILITIES = ['catalog', 'inventory', 'pricing', 'negotiation', 'checkout'];

const CAPABILITY_MAP: Record<string, string[]> = {
  'catalog': ['catalog.search', 'catalog.get'],
  'inventory': ['inventory.check', 'inventory.reserve', 'inventory.release'],
  'checkout': ['checkout.create', 'opportunity.accept'],
  'negotiation': ['negotiation.create']
};

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
      
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }
      const userId = user.id;

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
        await tx.merchant.create({
          data: {
            id: merchantId,
            name: data.name || 'Factory Merchant',
            status: 'DRAFT',
            description: data.description
          }
        });

        await tx.merchantMembership.create({
          data: {
            userId: userId,
            merchantId: merchantId,
            role: 'OWNER'
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

        const fineGrainedCaps = validCapabilities.flatMap((cap: string) => CAPABILITY_MAP[cap] || []);
        const allCaps = [...new Set([...validCapabilities, ...fineGrainedCaps])];

        for (const cap of allCaps) {
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
      const merchantId = req.params.merchantId as string;
      const { products } = req.body;

      if (!Array.isArray(products)) {
        res.status(400).json({ error: 'Expected products array' });
        return;
      }

      const BATCH_SIZE = 50;
      let importedCount = 0;

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(async (p: any) => {
            let priceMinorNum = Number(p.priceMinor);
            if (isNaN(priceMinorNum) || priceMinorNum <= 0) {
              priceMinorNum = 99900;
            } else {
              priceMinorNum = Math.round(priceMinorNum);
            }

            const qty = p.quantity !== undefined && !isNaN(parseInt(p.quantity, 10)) ? parseInt(p.quantity, 10) : 50;

            await prisma.product.create({
              data: {
                merchantId,
                name: (p.name || 'Unnamed Product').slice(0, 200),
                description: (p.description || '').slice(0, 1000),
                priceMinor: priceMinorNum,
                currency: p.currency || 'INR',
                active: p.active !== false,
                inventory: {
                  create: {
                    merchantId,
                    quantity: qty
                  }
                }
              }
            });
            importedCount++;
          })
        );
      }

      res.status(200).json({ success: true, imported: importedCount });
    } catch (error: any) {
      console.error('[Factory Upload Catalog Error]', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateInventory(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = req.params.merchantId as string;
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
