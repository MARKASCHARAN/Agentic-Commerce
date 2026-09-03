import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';
import { OutboxRepository } from '../../../infrastructure/database/repositories/outbox.repository.js';
import { createCommerceMissionHandler } from '../../../modules/commerce/mission-handler.js';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const outboxRepo = new OutboxRepository(prisma);
const missionHandler = createCommerceMissionHandler(prisma);

export const startCommerceMissionTool = {
  name: 'merchant.start_commerce_mission',
  description: `Execute an autonomous end-to-end agentic commerce mission on behalf of a buyer.

Use this tool when a buyer provides a high-level purchasing objective (e.g. "I have a budget of ₹2,00,000. Find me the best 32GB laptop, negotiate accessories, and email me the final offer for payment approval").

This tool will:
1. Persist the commerce mission to PostgreSQL and dispatch it to the outbox event queue.
2. Search the merchant catalog asynchronously for products matching requirements.
3. Run Revenue Intelligence detectors to identify high-value complementary cross-sells/accessories within budget.
4. Dynamically negotiate optimal pricing against merchant guardrails.
5. Reserve inventory and create a secure Razorpay transaction link.
6. Email a rich negotiated proposal & payment approval link directly to the buyer.`,

  schema: {
    budgetMinor: z.number().describe('Total max budget in minor units (e.g., 20000000 for ₹2,00,000)'),
    requirements: z.string().describe('Search requirements (e.g. "laptop 32GB RAM" or "electronics")'),
    buyerEmail: z.string().email().describe('Email address where the final negotiated offer & payment link will be delivered')
  },

  handler: async ({ budgetMinor, requirements, buyerEmail }: { budgetMinor: number; requirements: string; buyerEmail: string }) => {
    try {
      const ctx = getMcpContext();
      const eventId = crypto.randomUUID();

      // 1. Persist Commerce Mission as an OutboxEvent in PostgreSQL
      await outboxRepo.create({
        eventId,
        eventType: 'commerce.mission.requested',
        aggregateType: 'CommerceMission',
        aggregateId: eventId,
        payload: {
          eventId,
          merchantId: ctx.merchantId,
          buyerId: ctx.buyerId,
          sessionId: ctx.sessionId,
          budgetMinor,
          requirements,
          buyerEmail
        }
      });

      // 2. Execute background commerce mission
      const result = await missionHandler({
        payload: {
          eventId,
          merchantId: ctx.merchantId,
          buyerId: ctx.buyerId,
          sessionId: ctx.sessionId,
          budgetMinor,
          requirements,
          buyerEmail
        }
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: 'MISSION_PERSISTED_AND_DISPATCHED',
            message: 'Commerce mission persisted in backend database and dispatched to background outbox queue. The buyer may safely close the chat window.',
            missionId: eventId,
            buyerEmail,
            queue: 'agentic-commerce-outbox'
          }, null, 2)
        }]
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ code: 'COMMERCE_MISSION_FAILED', message: e.message }) }]
      };
    }
  }
};
