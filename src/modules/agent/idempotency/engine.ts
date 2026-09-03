import { PrismaIdempotencyRepository } from '../../../infrastructure/database/repositories/idempotency.repository';
import { generateRequestFingerprint } from './fingerprint';
import { IdempotencyConflictError, IdempotencyInProgressError, IdempotencyUnknownError } from './errors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export class IdempotencyEngine {
  constructor(private readonly repo: PrismaIdempotencyRepository) {}

  async execute<TInput, TOutput>(
    key: string,
    scope: string,
    input: TInput,
    operation: () => Promise<TOutput>
  ): Promise<TOutput> {
    if (!key || key.trim() === '') {
      throw new Error('Idempotency key cannot be empty');
    }
    if (!scope || scope.trim() === '') {
      throw new Error('Idempotency scope cannot be empty');
    }

    const fingerprint = generateRequestFingerprint(input);

    let reservationId: string;

    try {
      // [IDEMPOTENCY] [CONCURRENCY CONTROL]
      // Relying on PostgreSQL unique constraints (P2002) for at-most-once execution guarantees.
      // Unlike Redis locks which can expire or suffer from clock drift during GC pauses, 
      // the RDBMS provides strict ACID durability, eliminating crash-window double spends.
      const record = await this.repo.createReservation(key, scope, fingerprint);
      reservationId = record.id;
    } catch (err: any) {
      
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        return await this.handleExistingRecord(key, scope, fingerprint);
      }
      throw err;
    }

    try {
      const result = await operation();
      await this.repo.markCompleted(reservationId, result);
      return result;
    } catch (err: any) {

      const isRetryable = this.isRetryableError(err);
      if (isRetryable) {
        await this.repo.markFailed(reservationId, this.serializeError(err));
      } else {
        await this.repo.markUnknown(reservationId, this.serializeError(err));
      }
      throw err;
    }
  }

  private async handleExistingRecord(key: string, scope: string, fingerprint: string): Promise<any> {
    const record = await this.repo.getRecord(key, scope);
    if (!record) {

      throw new IdempotencyConflictError(`Idempotency record for ${scope}:${key} disappeared during resolution.`);
    }

    if (record.requestFingerprint !== fingerprint) {
      throw new IdempotencyConflictError(
        `Idempotency key ${key} was reused with a materially different request fingerprint.`
      );
    }

    switch (record.status) {
      case 'COMPLETED':
        return record.result;
        
      case 'FAILED':

        throw new IdempotencyConflictError(`Operation ${key} previously failed. Use a new idempotency key to retry.`);

      case 'UNKNOWN':
        // [FINANCIAL SAFETY] 
        // Network timeouts (e.g., ECONNRESET) leave execution state ambiguous.
        // Blindly retrying could trigger a double-spend if the provider received the request.
        // We halt retries and force reconciliation via webhook or manual intervention.
        throw new IdempotencyUnknownError(
          `Operation ${key} is in an UNKNOWN state (e.g., previous crash or network timeout). ` +
          `Manual reconciliation or status lookup is required before retrying.`
        );

      case 'IN_PROGRESS':

        const fiveMinutes = 5 * 60 * 1000;
        const isStale = (Date.now() - record.createdAt.getTime()) > fiveMinutes;
        
        if (isStale) {
          await this.repo.markUnknown(record.id, { reason: 'stale_in_progress' });
          throw new IdempotencyUnknownError(`Operation ${key} was stuck IN_PROGRESS and marked UNKNOWN.`);
        }
        
        throw new IdempotencyInProgressError(`Operation ${key} is currently in progress.`);
        
      default:
        throw new Error(`Unrecognized idempotency status: ${record.status}`);
    }
  }

  private isRetryableError(err: any): boolean {
    
    const safeErrorNames = [
      'ToolValidationError',
      'PolicyAuthorizationError',
      'PolicyApprovalRequiredError',
      'PolicyExecutionError',
      'InvalidTransitionError'
    ];
    return safeErrorNames.includes(err?.name) || err?.isRetryable === true;
  }

  private serializeError(err: any): any {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack
      };
    }
    return err;
  }
}
