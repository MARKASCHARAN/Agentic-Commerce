import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';

const prisma = new PrismaClient();

export const getOrderTool = {
  name: 'merchant.get_order',
  description: `Retrieve the status and details of a commerce order.

AUTHORITATIVE DATA RULE
The merchant backend is the sole authority for:
- order status
- payment status
- amount
- items
- quantity
- payment ID
- currency

If merchant.get_order fails, do not infer or reconstruct any of these values from conversation history. Report the tool failure to the buyer.`,
  schema: {
    orderId: z.string().describe('The ID of the order to retrieve.')
  },
  handler: async ({ orderId }: { orderId: string }) => {
    try {
      const ctx = getMcpContext();

      const order = await prisma.commerceOrder.findUnique({ where: { id: orderId } });
      if (!order) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, code: "ORDER_NOT_FOUND", message: "Order not found" }) }] };
      }
      
      // Removed strict sessionId check for Hackathon demo reconnects

      return {
        content: [{ type: "text", text: JSON.stringify({
          success: true,
          orderId: order.id,
          status: order.status,
          total: order.total
        }, null, 2) }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "ORDER_RETRIEVAL_FAILED", message: e.message }) }] };
    }
  }
};
