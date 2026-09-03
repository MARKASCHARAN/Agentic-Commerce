import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ProtocolEngine } from '../../src/agent/protocol/protocol-engine.js';
import { PricingService } from '../../src/agent/intelligence/pricing-service.js';
import { PaymentProvider } from '../../src/agent/payments/provider.js';

describe('Protocol Engine URL Validation', () => {
  const prisma = new PrismaClient();
  const pricingService = new PricingService(prisma);
  
  const mockPaymentProvider: PaymentProvider = {
    createPaymentLink: vi.fn(),
    fetchPayment: vi.fn(),
    capturePayment: vi.fn(),
    issueRefund: vi.fn()
  };

  const protocolEngine = new ProtocolEngine(prisma, pricingService, mockPaymentProvider);

  let merchantId: string;
  let buyerId: string;
  let sessionId: string;
  let testOfferId: string;

  beforeEach(async () => {
    merchantId = 'm_' + Date.now();
    buyerId = 'b_' + Date.now();
    sessionId = 's_' + Date.now();

    await prisma.merchant.create({ 
      data: { 
        id: merchantId, 
        name: 'Test Merchant',
        user: { create: { email: `test_${merchantId}@example.com`, name: 'Test' } }
      } 
    });
    await prisma.session.create({ data: { id: sessionId, merchantId, state: 'ACTIVE' } });

    const offer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [],
        subtotalMinor: 1000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 1000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 86400000)
      }
    });
    testOfferId = offer.id;
  });

  afterEach(async () => {
    await prisma.paymentIntent.deleteMany({ where: { order: { merchantId } } });
    await prisma.commerceOrder.deleteMany({ where: { merchantId } });
    await prisma.offer.deleteMany({ where: { merchantId } });
    await prisma.session.delete({ where: { id: sessionId } });
    await prisma.merchant.delete({ where: { id: merchantId } });
    vi.resetAllMocks();
  });

  it('prefers the real short_url when one exists', async () => {
    const realShortUrl = 'https://rzp.io/i/REAL_SHORT_URL';
    vi.mocked(mockPaymentProvider.createPaymentLink).mockResolvedValue({
      success: true,
      data: {
        providerId: 'plink_123',
        shortUrl: realShortUrl,
        amount: 1000,
        currency: 'INR',
        status: 'created'
      },
      providerRawStatus: 'created',
      providerRawResponse: {}
    });

    const result = await protocolEngine.acceptOffer(testOfferId, buyerId);
    
    expect(result.paymentUrl).toBe(realShortUrl);
    expect(result.paymentUrl).not.toContain('localhost');
  });

  it('throws an error instead of fabricating rzp.io URL when provider returns undefined shortUrl', async () => {
    vi.mocked(mockPaymentProvider.createPaymentLink).mockResolvedValue({
      success: true,
      data: {
        providerId: 'plink_123',
        amount: 1000,
        currency: 'INR',
        status: 'created',
        // shortUrl is intentionally missing
      } as any,
      providerRawStatus: 'created',
      providerRawResponse: {}
    });

    await expect(protocolEngine.acceptOffer(testOfferId, buyerId))
      .rejects.toThrow('Payment provider did not return a valid shortUrl');
  });
  
  it('explicitly returns localhost ONLY when provider specifically returns it (limit fallback)', async () => {
    const fallbackLocalhostUrl = 'http://localhost:3000/pay/order_123';
    vi.mocked(mockPaymentProvider.createPaymentLink).mockResolvedValue({
      success: true,
      data: {
        providerId: 'order_123',
        shortUrl: fallbackLocalhostUrl,
        amount: 1000,
        currency: 'INR',
        status: 'created'
      },
      providerRawStatus: 'created',
      providerRawResponse: {}
    });

    const result = await protocolEngine.acceptOffer(testOfferId, buyerId);
    
    expect(result.paymentUrl).toBe(fallbackLocalhostUrl);
  });
});
