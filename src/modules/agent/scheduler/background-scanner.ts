import { PrismaClient } from '@prisma/client';
import { RevenueRecoveryDetector } from '../../revenue/detectors/revenue-recovery.detector';
import { RepeatPurchaseDetector } from '../../revenue/detectors/repeat-purchase.detector';
import { RevenueTracker } from '../../revenue/revenue-tracker';
import { MerchantCapabilityResolver } from '../../revenue/capability-resolver';

export class BackgroundCommerceScanner {
  private readonly recoveryDetector: RevenueRecoveryDetector;
  private readonly repeatDetector: RepeatPurchaseDetector;
  private readonly revenueTracker: RevenueTracker;
  private readonly capabilityResolver: MerchantCapabilityResolver;

  constructor(private readonly prisma: PrismaClient) {
    this.recoveryDetector = new RevenueRecoveryDetector(prisma);
    this.repeatDetector = new RepeatPurchaseDetector(prisma);
    this.revenueTracker = new RevenueTracker(prisma);
    this.capabilityResolver = new MerchantCapabilityResolver();
  }

  async scanAll(merchantId: string): Promise<{ recoveryCount: number; repeatCount: number }> {
    const capabilities = await this.capabilityResolver.resolve(merchantId);
    let recoveryCount = 0;
    let repeatCount = 0;

    // 1. Scan Abandoned / Failed Carts for Recovery Opportunities
    const idleTimeMinutes = 10;
    const thresholdDate = new Date(Date.now() - idleTimeMinutes * 60 * 1000);

    const idleCarts = await this.prisma.cart.findMany({
      where: {
        updatedAt: { lte: thresholdDate }
      }
    });

    for (const cart of idleCarts) {
      const opps = await this.recoveryDetector.detect(merchantId, capabilities, {
        sessionId: cart.sessionId,
        checkoutAbandoned: true
      });

      for (const opp of opps) {
        await this.revenueTracker.logProposal(opp);
        recoveryCount++;
      }
    }

    // 2. Scan Completed Orders for Due Replenishment Cycles
    const sessionsWithCompletedOrders = await this.prisma.commerceOrder.findMany({
      where: {
        merchantId,
        status: { in: ['completed', 'captured', 'paid'] }
      },
      select: { sessionId: true }
    });

    const sessionIds = Array.from(new Set(sessionsWithCompletedOrders.map(s => s.sessionId)));

    for (const sessionId of sessionIds) {
      const opps = await this.repeatDetector.detect(merchantId, capabilities, {
        sessionId,
        replenishmentDue: true
      });

      for (const opp of opps) {
        await this.revenueTracker.logProposal(opp);
        repeatCount++;
      }
    }

    return { recoveryCount, repeatCount };
  }
}
