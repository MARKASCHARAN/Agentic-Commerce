import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisService } from '../../src/database/redis/redis-client';
import { RateLimiter } from '../../src/agent/rate-limiting/rate-limiter';
import { RateLimitExceededError, RateLimitInfrastructureError } from '../../src/agent/rate-limiting/errors';
import { randomUUID } from 'crypto';

describe('RateLimiter Integration', () => {
  let redis: RedisService;
  let rateLimiter: RateLimiter;

  beforeEach(async () => {
    redis = new RedisService({ url: 'redis://localhost:6380' });
    await redis.connect();
    rateLimiter = new RateLimiter(redis);
    
    const rawClient = (redis as any).client;
    await rawClient.flushdb();
  });

  afterEach(async () => {
    await redis.disconnect();
  });

  it('should allow requests within limit', async () => {
    const agentId = randomUUID();
    
    await expect(rateLimiter.consume([{
      identity: { type: 'agent', id: agentId },
      config: { capacity: 5, refillRatePerSecond: 1, failClosed: true }
    }])).resolves.not.toThrow();
  });

  it('should reject requests exceeding limit with exact retryAfterMs', async () => {
    const agentId = randomUUID();

    for (let i = 0; i < 5; i++) {
      await rateLimiter.consume([{
        identity: { type: 'agent', id: agentId },
        config: { capacity: 5, refillRatePerSecond: 1, failClosed: true }
      }]);
    }

    try {
      await rateLimiter.consume([{
        identity: { type: 'agent', id: agentId },
        config: { capacity: 5, refillRatePerSecond: 1, failClosed: true }
      }]);
      expect.fail('Should have thrown RateLimitExceededError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(RateLimitExceededError);
      expect(e.metadata.limit).toBe(5);
      expect(e.metadata.remaining).toBeLessThan(1);
      expect(e.metadata.retryAfterMs).toBeGreaterThan(0);
      expect(e.metadata.retryAfterMs).toBeLessThanOrEqual(1000); 
    }
  });

  it('should consume multiple buckets atomically and roll back if one fails', async () => {
    const agentId = randomUUID();
    const sessionId = randomUUID();

    await rateLimiter.consume([
      { identity: { type: 'agent', id: agentId }, config: { capacity: 10, refillRatePerSecond: 10, failClosed: true } },
      { identity: { type: 'session', id: sessionId }, config: { capacity: 1, refillRatePerSecond: 0.1, failClosed: true } }
    ]);

    await expect(rateLimiter.consume([
      { identity: { type: 'agent', id: agentId }, config: { capacity: 10, refillRatePerSecond: 10, failClosed: true } },
      { identity: { type: 'session', id: sessionId }, config: { capacity: 1, refillRatePerSecond: 0.1, failClosed: true } }
    ])).rejects.toThrow(RateLimitExceededError);

    for (let i = 0; i < 9; i++) {
      await expect(rateLimiter.consume([
        { identity: { type: 'agent', id: agentId }, config: { capacity: 10, refillRatePerSecond: 10, failClosed: true } }
      ])).resolves.not.toThrow();
    }

    await expect(rateLimiter.consume([
      { identity: { type: 'agent', id: agentId }, config: { capacity: 10, refillRatePerSecond: 10, failClosed: true } }
    ])).rejects.toThrow(RateLimitExceededError);
  });

  it('should handle 100 concurrent requests securely (exactly N allowed)', async () => {
    const toolId = randomUUID();
    const limit = 20;

    const reqs = Array.from({ length: 100 }).map(() => 
      rateLimiter.consume([{
        identity: { type: 'tool', id: toolId },
        config: { capacity: limit, refillRatePerSecond: 0, failClosed: true }
      }])
    );

    const results = await Promise.allSettled(reqs);

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected' && r.reason instanceof RateLimitExceededError).length;

    expect(successes).toBe(limit);
    expect(failures).toBe(100 - limit);
  });

  it('should fail-closed if Redis is down and config requires it', async () => {
    const badRedis = new RedisService({ url: 'redis://localhost:9999' });
    const badLimiter = new RateLimiter(badRedis);
    
    await badRedis.connect().catch(() => {}); 

    await expect(badLimiter.consume([{
      identity: { type: 'tool', id: 'fail-closed-test' },
      config: { capacity: 10, refillRatePerSecond: 1, failClosed: true }
    }])).rejects.toThrow(RateLimitInfrastructureError);
  });

  it('should fail-open if Redis is down and config allows it', async () => {
    const badRedis = new RedisService({ url: 'redis://localhost:9999' });
    const badLimiter = new RateLimiter(badRedis);
    await badRedis.connect().catch(() => {});

    await expect(badLimiter.consume([{
      identity: { type: 'tool', id: 'fail-open-test' },
      config: { capacity: 10, refillRatePerSecond: 1, failClosed: false }
    }])).resolves.not.toThrow(); 
  });
});
