export interface RateLimitConfig {
  /**
   * The maximum number of tokens the bucket can hold.
   * Also serves as the initial burst capacity.
   */
  capacity: number;
  
  /**
   * How many tokens are added to the bucket per second.
   */
  refillRatePerSecond: number;
  
  /**
   * If true, failure to connect to Redis will result in a RateLimitInfrastructureError,
   * explicitly denying the execution. If false, network failures will gracefully allow execution.
   */
  failClosed: boolean;
}

export type RateLimitType = 'agent' | 'session' | 'tool' | 'merchant' | 'ip';

export interface RateLimitIdentity {
  type: RateLimitType;
  id: string;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed.
   */
  allowed: boolean;

  /**
   * The number of tokens remaining in this specific bucket.
   */
  remaining: number;

  /**
   * If allowed=false, the time in milliseconds to wait before retrying.
   * If allowed=true, this is 0.
   */
  retryAfterMs: number;
}
