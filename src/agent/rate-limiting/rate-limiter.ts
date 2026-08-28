import { RedisService } from '../../database/redis';
import { RedisOperationError } from '../../database/redis/errors';
import { MULTI_TOKEN_BUCKET_LUA } from './lua-scripts';
import { RateLimitConfig, RateLimitIdentity, RateLimitResult } from './types';
import { RateLimitConfigurationError, RateLimitExceededError, RateLimitInfrastructureError } from './errors';

export interface RateLimiterRequest {
  identity: RateLimitIdentity;
  config: RateLimitConfig;
  cost?: number; 
}

export class RateLimiter {
  constructor(private readonly redis: RedisService) {}

  async consume(requests: RateLimiterRequest[]): Promise<void> {
    if (requests.length === 0) return;

    this.validateRequests(requests);

    const keys: string[] = [];
    const args: (string | number)[] = [Date.now()]; 

    let requiresFailClosed = false;

    for (const req of requests) {
      if (req.config.failClosed) {
        requiresFailClosed = true;
      }
      keys.push(`agentic:ratelimit:${req.identity.type}:${req.identity.id}`);
      args.push(req.config.capacity);
      args.push(req.config.refillRatePerSecond);
      args.push(req.cost ?? 1);
    }

    let rawResults: any;
    try {
      rawResults = await this.redis.eval<Array<[number, number, number]>>(MULTI_TOKEN_BUCKET_LUA, keys, args);
    } catch (error: any) {
      if (error instanceof RedisOperationError) {
        if (requiresFailClosed) {
          throw new RateLimitInfrastructureError(
            `Redis failure during rate limit check (fail-closed constraint present)`, 
            error
          );
        }
        
        return;
      }
      throw error;
    }

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const resultData = rawResults[i];
      
      const allowed = resultData[0] === 1;
      const remaining = resultData[1];
      const retryAfterMs = resultData[2];

      if (!allowed) {
        throw new RateLimitExceededError(
          req.identity,
          req.config.capacity,
          remaining,
          retryAfterMs
        );
      }
    }
  }

  private validateRequests(requests: RateLimiterRequest[]): void {
    for (const req of requests) {
      if (!req.identity.id || req.identity.id.trim() === '') {
        throw new RateLimitConfigurationError('Rate limit identity ID cannot be empty');
      }
      if (!req.identity.type || req.identity.type.trim() === '') {
        throw new RateLimitConfigurationError('Rate limit identity type cannot be empty');
      }
      if (req.config.capacity <= 0 || !Number.isFinite(req.config.capacity)) {
        throw new RateLimitConfigurationError('Capacity must be a finite positive number');
      }
      if (req.config.refillRatePerSecond < 0 || !Number.isFinite(req.config.refillRatePerSecond)) {
        throw new RateLimitConfigurationError('Refill rate must be a finite non-negative number');
      }
      const cost = req.cost ?? 1;
      if (cost < 0 || !Number.isFinite(cost)) {
        throw new RateLimitConfigurationError('Cost must be a finite non-negative number');
      }
    }
  }
}
