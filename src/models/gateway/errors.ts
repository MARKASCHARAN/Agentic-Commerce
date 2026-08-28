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
