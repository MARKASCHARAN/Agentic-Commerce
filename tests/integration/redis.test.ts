import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisService } from '../../src/database/redis/redis-client';
import { RedisOperationError, RedisConnectionError } from '../../src/database/redis/errors';

describe('Redis Foundation Integration', () => {
  
  const redisUrl = 'redis://localhost:6380';
  let redis: RedisService;

  beforeAll(async () => {
    redis = new RedisService({ url: redisUrl });
    await redis.connect();
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  it('should successfully ping a connected Redis instance', async () => {
    const response = await redis.ping();
    expect(response).toBe('PONG');
  });

  it('should set and get a key successfully', async () => {
    const key = 'agentic:test:domain:simple-key';
    const value = 'hello-redis';
    
    await redis.set(key, value);
    const result = await redis.get(key);
    
    expect(result).toBe(value);

    await redis.del(key);
  });

  it('should return null for non-existent keys', async () => {
    const result = await redis.get('agentic:test:domain:missing-key');
    expect(result).toBeNull();
  });

  it('should explicitly fail operations if disconnected (fail safely)', async () => {
    const isolatedRedis = new RedisService({ url: redisUrl });

    await expect(isolatedRedis.ping()).rejects.toThrowError(RedisOperationError);
    await expect(isolatedRedis.set('k', 'v')).rejects.toThrowError(RedisOperationError);
  });

  it('should explicitly fail to connect to a bad URL', async () => {
    const badRedis = new RedisService({ url: 'redis://localhost:9999' });
    
    await expect(badRedis.connect()).rejects.toThrowError(RedisConnectionError);
  }, 10000); 
});
