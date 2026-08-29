import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RazorpayWebhookAdapter } from '../../src/providers/razorpay/razorpay.webhook';

// Razorpay officially uses crypto.createHmac for this
import crypto from 'crypto';

describe('Phase 28: Razorpay Webhook E2E', () => {
  const secret = 'test_secret';
  const adapter = new RazorpayWebhookAdapter(secret);

  const generateSignature = (payload: string, secret: string) => {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  };

  it('1. Valid webhook signature accepted', () => {
    const payload = JSON.stringify({
      account_id: 'acc_123',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', notes: { idempotency_key: 'ik_1' } } } }
    });
    
    const signature = generateSignature(payload, secret);
    const event = adapter.parse(payload, signature);
    
    expect(event.eventType).toBe('payment.captured');
    expect(event.providerEntityId).toBe('pay_123');
    expect(event.idempotencyKey).toBe('ik_1');
  });

  it('2. Invalid signature rejected', () => {
    const payload = JSON.stringify({
      account_id: 'acc_123',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123' } } }
    });
    
    const signature = 'invalid_signature_hex';
    expect(() => adapter.parse(payload, signature)).toThrowError('Failed to validate webhook signature');
  });

  it('3. Missing event type in payload rejected', () => {
    const payload = JSON.stringify({
      account_id: 'acc_123',
      payload: { payment: { entity: { id: 'pay_123' } } }
    });
    
    const signature = generateSignature(payload, secret);
    expect(() => adapter.parse(payload, signature)).toThrowError('Missing event type');
  });
});
