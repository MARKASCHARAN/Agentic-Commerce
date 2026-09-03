import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryRevenueController {
  static async listOpportunities(req: Request, res: Response) {
    try {
      const merchantId = req.params.merchantId as string;
      const { status, limit = 50, offset = 0 } = req.query;

      // Auto-reconcile any paid offers to update order status to PAID
      try {
        const paidOffers = await prisma.offer.findMany({
          where: { merchantId, status: 'PAID' }
        });
        const paidOrderIds = paidOffers.map(o => o.orderId).filter(Boolean) as string[];
        if (paidOrderIds.length > 0) {
          await prisma.commerceOrder.updateMany({
            where: {
              id: { in: paidOrderIds },
              status: { notIn: ['captured', 'PAID', 'COMPLETED'] }
            },
            data: { status: 'PAID' }
          });
        }
      } catch (e) {
        console.warn('[Auto-reconcile Warning]', e);
      }

      const where: any = { merchantId };
      if (status) {
        where.status = status as string;
      }

      // Fetch opportunity logs
      const [opportunityLogs, totalOpps] = await Promise.all([
        prisma.revenueOpportunityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.revenueOpportunityLog.count({ where }),
      ]);

      // Fetch completed and total orders to calculate actual agent revenue & conversion rate
      const completedOrders = await prisma.commerceOrder.findMany({
        where: {
          merchantId,
          status: { in: ['captured', 'PAID', 'COMPLETED'] }
        } as any,
        orderBy: { createdAt: 'desc' }
      });

      const totalOrders = await prisma.commerceOrder.count({
        where: { merchantId } as any
      });

      const revenueGeneratedMinor = completedOrders.reduce((sum, o) => sum + Math.round(o.total * 100), 0);
      const conversionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 0;

      // Calculate negotiation savings from accepted/paid offers
      const offers = await prisma.offer.findMany({
        where: {
          merchantId,
          status: { in: ['PAID', 'PAYMENT_PENDING', 'ACCEPTED'] }
        } as any
      });

      const totalSavingsMinor = offers.reduce((sum, offer) => sum + offer.discountMinor, 0);
      const averageNegotiationSavingsMinor = offers.length > 0 ? Math.round(totalSavingsMinor / offers.length) : 0;

      // Map order totals
      const orderTotalMap = new Map<string, number>();
      completedOrders.forEach(o => {
        orderTotalMap.set(o.id, Math.round(o.total * 100));
      });

      // Map explicit opportunity logs
      const loggedOrderIds = new Set(opportunityLogs.map(l => l.orderId).filter(Boolean));

      const opportunities: any[] = opportunityLogs.map(log => {
        const orderTotalMinor = log.orderId ? orderTotalMap.get(log.orderId) : undefined;
        return {
          id: log.id,
          type: log.opportunityType,
          amountMinor: log.expectedImpactMinor || log.realizedImpactMinor || 0,
          expectedImpactMinor: log.expectedImpactMinor || 0,
          realizedImpactMinor: log.realizedImpactMinor || 0,
          orderTotalMinor: orderTotalMinor || log.realizedImpactMinor || log.expectedImpactMinor || 0,
          status: log.status,
          sessionId: log.sessionId,
          orderId: log.orderId,
          buyerId: log.buyerId,
          createdAt: log.createdAt,
          convertedAt: log.convertedAt,
          evidence: log.opportunityType === 'CROSS_SELL' 
            ? 'AI Detector identified complementary product pair (e.g. 65W GaN Charger with Laptop/Smartphone).'
            : log.opportunityType === 'UPSELL' 
            ? 'AI Detector identified higher-tier model upgrade option for active buyer.'
            : 'AI Agent optimized conversion & price agreement.'
        };
      });

      // Include completed orders that do NOT have a specific opportunity log as CONVERSION items (0 Add-On Uplift)
      completedOrders.forEach(order => {
        if (!loggedOrderIds.has(order.id)) {
          opportunities.push({
            id: order.id,
            type: 'CONVERSION',
            amountMinor: 0, // Direct Conversions have ₹0.00 Add-On Uplift
            expectedImpactMinor: 0,
            realizedImpactMinor: 0,
            orderTotalMinor: Math.round(order.total * 100),
            status: 'ACCEPTED',
            orderId: order.id,
            sessionId: order.sessionId,
            createdAt: order.createdAt,
            evidence: 'Autonomous transaction completed & captured.'
          });
        }
      });

      // ALWAYS sort the combined opportunities by newest date first!
      opportunities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Calculate PURE opportunity uplift (Cross-Sell add-on price / Upsell price difference)
      const opportunityUpliftMinor = opportunityLogs
        .filter(l => ['CROSS_SELL', 'UPSELL', 'AOV_EXPANSION'].includes(l.opportunityType) && l.status === 'CONVERTED')
        .reduce((sum, l) => sum + (l.expectedImpactMinor || 0), 0);

      // Calculate type breakdowns across combined list
      const crossSellCount = opportunities.filter(l => l.type === 'CROSS_SELL').length;
      const upsellCount = opportunities.filter(l => l.type === 'UPSELL').length;
      const aovCount = opportunities.filter(l => l.type === 'AOV_EXPANSION').length;
      const conversionCount = opportunities.filter(l => l.type === 'CONVERSION').length;

      const metrics = {
        totalOpportunities: Math.max(totalOpps, opportunities.length),
        conversionRate,
        revenueGeneratedMinor,
        opportunityUpliftMinor: opportunityUpliftMinor,
        totalNegotiationSavingsMinor: totalSavingsMinor,
        averageNegotiationSavingsMinor,
        crossSellCount,
        upsellCount,
        aovCount,
        conversionCount,
        breakdown: {
          CROSS_SELL: crossSellCount,
          UPSELL: upsellCount,
          AOV_EXPANSION: aovCount,
          CONVERSION: conversionCount
        }
      };

      res.json({
        data: opportunities,
        opportunities,
        metrics,
        meta: { total: Math.max(totalOpps, opportunities.length), limit: Number(limit), offset: Number(offset) }
      });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }
}
