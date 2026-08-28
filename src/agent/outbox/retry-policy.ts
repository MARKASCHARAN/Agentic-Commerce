export enum FailureClass {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN'
}

export interface RetryPolicyConfig {
  maxAttempts: number;
  backoffBaseMs: number;
  maxBackoffMs: number;
  jitterMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryPolicyConfig = {
  maxAttempts: 5,
  backoffBaseMs: 1000,
  maxBackoffMs: 30000,
  jitterMs: 500,
};

export function classifyError(err: any): FailureClass {
  const name = err?.name || err?.constructor?.name || '';
  const msg = (err?.message || '').toLowerCase();

  if (name === 'PaymentUnknownError' || name === 'PaymentProviderTimeoutError' || name === 'IdempotencyUnknownError') {
    return FailureClass.UNKNOWN;
  }
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('enotfound')) {
    return FailureClass.UNKNOWN;
  }

  const permanentErrors = [
    'IdempotencyConflictError',
    'ValidationError',
    'PolicyDenialError',
    'AuthorizationError',
    'InvalidCredentialsError'
  ];
  if (permanentErrors.includes(name)) {
    return FailureClass.PERMANENT;
  }
  if (
    msg.includes('validation') ||
    msg.includes('unauthorized') ||
    msg.includes('denied') ||
    msg.includes('idempotency conflict') ||
    msg.includes('permanent failure')
  ) {
    return FailureClass.PERMANENT;
  }

  if (name === 'RateLimitError' || name === 'TransientError' || msg.includes('429') || msg.includes('503')) {
    return FailureClass.TRANSIENT;
  }

  return FailureClass.UNKNOWN;
}

export function calculateBackoff(attempt: number, config: RetryPolicyConfig): number {
  
  const exponentialDelay = config.backoffBaseMs * Math.pow(2, Math.max(0, attempt - 1));
  const boundedDelay = Math.min(config.maxBackoffMs, exponentialDelay);

  const jitter = Math.random() * config.jitterMs;
  
  return Math.floor(boundedDelay + jitter);
}
