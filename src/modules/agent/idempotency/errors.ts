export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyInProgressError';
  }
}

export class IdempotencyUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyUnknownError';
  }
}

export class IdempotencyRecordDeletedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyRecordDeletedError';
  }
}
