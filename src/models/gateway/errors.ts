/**
 * Determines whether an error from the model gateway is retryable.
 * Network errors and rate limits are retryable, but validation errors
 * and bad requests (400, 401, 403, 404) are not.
 * 
 * @param error - The error object to evaluate
 * @returns boolean indicating if the error can be safely retried
 */
export function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as Record<string, any>;

  if (
    err.name === 'TypeValidationError' ||
    err.name === 'JSONParseError' ||
    err.name === 'NoObjectGeneratedError'
  ) {
    return false;
  }

  if (err.statusCode) {
    const status = err.statusCode as number;
    if (status === 408 || status === 429 || status >= 500) {
      return true;
    }
    return false;
  }

  if (err.code && typeof err.code === 'string') {
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'];
    if (retryableCodes.includes(err.code)) {
      return true;
    }
  }

  return false;
}
