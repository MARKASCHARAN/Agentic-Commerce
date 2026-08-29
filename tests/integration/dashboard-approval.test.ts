import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import uiRouter from '../../src/api/routes/ui.routes';

describe('Phase 40 & Phase 41: Dashboard Rates & Human Approval UX', () => {
  let prisma: PrismaClient;
  const merchantId = 'merchant-dash-appr-test';
  const userId = 'user-dash-appr-test';
  const sessionId = 'sess-dash-appr-test';
  const oppIdReview = 'opp-review-123';
  const oppIdConverted = 'opp-conv-123';

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Clean up
    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.revenueOpportunityLog.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed
    await prisma.user.create({ data: { id: userId, email: 'dash@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Dashboard Approval Merchant' } });
    await prisma.session.create({ data: { id: sessionId, userId, merchantId, state: 'ACTIVE' } });

    // Seed opportunity log for review requirement
    await prisma.revenueOpportunityLog.create({
      data: {
        id: oppIdReview,
        merchantId,
        sessionId,
        opportunityType: 'UPSELL',
        expectedImpactMinor: 50000,
        status: 'PROPOSED'
      }
    });

    // Seed converted opportunity log
    await prisma.revenueOpportunityLog.create({
      data: {
        id: oppIdConverted,
        merchantId,
        sessionId,
        opportunityType: 'CROSS_SELL',
        expectedImpactMinor: 20000,
        realizedImpactMinor: 20000,
        status: 'CONVERTED'
      }
    });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.revenueOpportunityLog.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. GET /api/dashboard returns measured performance rates (upsellRate, crossSellRate, etc.)', async () => {
    const req = {
      query: { merchantId },
      headers: {}
    } as any;

    let resData: any = null;
    const res = {
      status: (code: number) => ({
        json: (data: any) => { resData = { code, data }; }
      }),
      json: (data: any) => { resData = { code: 200, data }; }
    } as any;

    const dashboardRoute = uiRouter.stack.find(l => l.route && l.route.path === '/dashboard');
    expect(dashboardRoute).toBeDefined();

    await dashboardRoute!.route.stack[0].handle(req, res);

    expect(resData).not.toBeNull();
    expect(resData.code).toBe(200);
    expect(resData.data.performanceRates).toBeDefined();
    expect(resData.data.performanceRates.crossSellRate).toBe(100.00); // 1 converted out of 1
    expect(resData.data.performanceRates.upsellRate).toBe(0.00); // 0 converted out of 1 proposed
  });

  it('2. POST /api/approval/decide allows human operator to approve an opportunity', async () => {
    const req = {
      body: {
        opportunityId: oppIdReview,
        merchantId,
        decision: 'APPROVE',
        approverId: 'human_manager_1'
      }
    } as any;

    let resData: any = null;
    const res = {
      status: (code: number) => ({
        json: (data: any) => { resData = { code, data }; }
      }),
      json: (data: any) => { resData = { code: 200, data }; }
    } as any;

    const decideRoute = uiRouter.stack.find(l => l.route && l.route.path === '/approval/decide');
    expect(decideRoute).toBeDefined();

    await decideRoute!.route.stack[0].handle(req, res);

    expect(resData).not.toBeNull();
    expect(resData.code).toBe(200);
    expect(resData.data.success).toBe(true);
    expect(resData.data.status).toBe('ACCEPTED');

    // Verify DB updated
    const updatedOpp = await prisma.revenueOpportunityLog.findUnique({ where: { id: oppIdReview } });
    expect(updatedOpp?.status).toBe('ACCEPTED');

    // Verify audit message created
    const auditMsg = await prisma.message.findFirst({
      where: { sessionId, type: 'audit_event' }
    });
    expect(auditMsg).not.toBeNull();
    expect((auditMsg?.payload as any).decision).toBe('APPROVE');
  });
});
