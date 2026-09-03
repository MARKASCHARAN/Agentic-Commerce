export interface RateLimitConfig {
  
  capacity: number;

  refillRatePerSecond: number;

  failClosed: boolean;
}

export type RateLimitType = 'agent' | 'session' | 'tool' | 'merchant' | 'ip';

export interface RateLimitIdentity {
  type: RateLimitType;
  id: string;
}

export interface RateLimitResult {
  
  allowed: boolean;

  remaining: number;

  retryAfterMs: number;
}
