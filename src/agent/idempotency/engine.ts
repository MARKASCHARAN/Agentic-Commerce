import { PrismaIdempotencyRepository } from '../../database/repositories/idempotency.repository';
import { generateRequestFingerprint } from './fingerprint';
import { IdempotencyConflictError, IdempotencyInProgressError, IdempotencyUnknownError } from './errors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export class IdempotencyEngine {
  constructor(private readonly repo: PrismaIdempotencyRepository) {}

  /**
   * Executes an operation idempotently.
   * If a record already exists, returns the cached result, or throws deterministic errors
   * for IN_PROGRESS, FAILED, UNKNOWN, or fingerprint conflicts.
   */
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
      const record = await this.repo.createReservation(key, scope, fingerprint);
      reservationId = record.id;
    } catch (err: any) {
      // P2002 is Prisma's Unique Constraint violation code
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        return await this.handleExistingRecord(key, scope, fingerprint);
      }
      throw err;
    }

    // Reservation succeeded. We have exclusive ownership.
    try {
      const result = await operation();
      await this.repo.markCompleted(reservationId, result);
      return result;
    } catch (err: any) {
      // If we got a system crash or process exit here, it remains IN_PROGRESS forever.
      // Next time it's retried, it triggers the UNKNOWN recovery logic in handleExistingRecord.

      // For standard caught errors, distinguish if it's a validation error (retryable/fail)
      // vs a network timeout (unknown outcome).
      // A simple heuristic: if it's a known non-network error, mark FAILED. 
      // If it's a network timeout where external side effect MIGHT have happened, mark UNKNOWN.
      // For this phase, if the adapter throws anything, we explicitly mark UNKNOWN to be safe
      // UNLESS the error explicitly declares it's safe to retry (e.g. ValidationError before network).
      
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
      // Rare race condition: it existed during createReservation, but was deleted before getRecord.
      // We throw a generic conflict to allow retry.
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
        // Explicitly failed, can be retried by starting a new workflow, but the idempotency engine
        // itself rejects re-execution of the same failed record to prevent blind loops.
        // The caller should generate a new idempotency key if they truly want to retry a failed operation.
        throw new IdempotencyConflictError(`Operation ${key} previously failed. Use a new idempotency key to retry.`);

      case 'UNKNOWN':
        throw new IdempotencyUnknownError(
          `Operation ${key} is in an UNKNOWN state (e.g., previous crash or network timeout). ` +
          `Manual reconciliation or status lookup is required before retrying.`
        );

      case 'IN_PROGRESS':
        // If it's been IN_PROGRESS for a long time (e.g. > 5 minutes), it might be a silent crash.
        // But for safety, we return UNKNOWN error to force explicit recovery, rather than blindly assuming crash.
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
    // If it's a validation error or policy authorization error, it never reached the network.
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
