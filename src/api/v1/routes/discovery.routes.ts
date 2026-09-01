import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/:merchantId', async (req, res) => {
  const { merchantId } = req.params;

  try {
    // 1. Fetch merchant details. (Assuming merchantId is meant to be the Agent ID or Merchant ID).
    // For the hackathon, we'll try to find the merchant or fallback to the seed 'agentic_electronics'.
    let merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { guardrails: true, strategy: true }
    });

    if (!merchant && merchantId === 'agentic_electronics') {
      // Find the first merchant if they used the mock ID from frontend
      merchant = await prisma.merchant.findFirst({
        include: { guardrails: true, strategy: true }
      });
    }

    if (!merchant) {
      return res.status(404).json({
        error: 'Merchant not found',
        code: 'MERCHANT_NOT_FOUND'
      });
    }

  // Construct the Agent Manifest, STRICTLY EXCLUDING any sensitive policy
  // or guardrail details (like max discounts, margins, etc.)
    const manifest = {
      version: '1.0',
      agent: {
        id: merchant.id,
        name: merchant.name,
        status: 'ONLINE'
      },
      merchant: {
        businessType: 'electronics',
        currency: 'INR'
      },
      commerce: {
        categories: ['laptops', 'accessories'],
        capabilities: [
          'catalog.search',
          'offer.create',
          'negotiation',
          'cross_sell',
          'upsell',
          'checkout'
        ]
      },
      policies: {
        negotiation: true,
        maxNegotiationRounds: 3
      },
      protocol: {
        version: '1.0',
        endpoint: `http://localhost:3000/v1/protocol/${merchant.id}`
      },
      mcp: {
        endpoint: `http://localhost:3001`
      }
    };

    res.json(manifest);
  } catch (error) {
    console.error('Discovery API Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
