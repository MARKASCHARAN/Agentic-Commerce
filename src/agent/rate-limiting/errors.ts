import { RateLimitIdentity, RateLimitResult } from './types';

export class RateLimitExceededError extends Error {
  public readonly metadata: {
    identity: RateLimitIdentity;
    limit: number;
    remaining: number;
    retryAfterMs: number;
  };

  constructor(
    identity: RateLimitIdentity,
    limit: number,
    remaining: number,
    retryAfterMs: number
  ) {
    super(`Rate limit exceeded for ${identity.type}:${identity.id}. Retry after ${retryAfterMs}ms`);
    this.name = 'RateLimitExceededError';
    this.metadata = {
      identity,
      limit,
      remaining,
      retryAfterMs
    };
  }
}

export class RateLimitInfrastructureError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RateLimitInfrastructureError';
  }
}

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitConfigurationError';
  }
}
