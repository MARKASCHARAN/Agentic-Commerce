export class RedisConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

export class RedisOperationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RedisOperationError';
  }
}
