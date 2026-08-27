export function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as Record<string, any>;

  // AI SDK Validation Errors
  if (
    err.name === 'TypeValidationError' ||
    err.name === 'JSONParseError' ||
    err.name === 'NoObjectGeneratedError'
  ) {
    return false;
  }

  // Network / API Call Errors
  if (err.statusCode) {
    const status = err.statusCode as number;
    // 408 Request Timeout, 429 Too Many Requests, 5xx Server Errors
    if (status === 408 || status === 429 || status >= 500) {
      return true;
    }
    // 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
    return false;
  }

  // ETIMEDOUT, ECONNRESET, ENOTFOUND etc. from node-fetch or similar
  if (err.code && typeof err.code === 'string') {
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'];
    if (retryableCodes.includes(err.code)) {
      return true;
    }
  }

  // Default to non-retryable for safety to avoid infinite loops of bad requests
  return false;
}
