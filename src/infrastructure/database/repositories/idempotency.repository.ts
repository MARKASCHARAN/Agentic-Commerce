import { PrismaClient } from '@prisma/client';
import { IdempotencyStatus, IdempotencyRecord } from '../../../modules/agent/idempotency/types';
import { IdempotencyRecordDeletedError } from '../../../modules/agent/idempotency/errors';

export class PrismaIdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createReservation(
    key: string,
    scope: string,
    fingerprint: string,
    tx?: any
  ): Promise<IdempotencyRecord> {
    const client = tx || this.prisma;
    const record = await client.idempotencyRecord.create({
      data: {
        idempotencyKey: key,
        scope,
        requestFingerprint: fingerprint,
        status: 'IN_PROGRESS'
      }
    });
    return this.mapToDomain(record);
  }

  async getRecord(key: string, scope: string, tx?: any): Promise<IdempotencyRecord | null> {
    const client = tx || this.prisma;
    const record = await client.idempotencyRecord.findUnique({
      where: {
        scope_idempotencyKey: {
          scope,
          idempotencyKey: key
        }
      }
    });
    return record ? this.mapToDomain(record) : null;
  }

  async markCompleted(id: string, result: any, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    try {
      await client.idempotencyRecord.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          result,
          completedAt: new Date()
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new IdempotencyRecordDeletedError(`Idempotency record ${id} was deleted before it could be marked COMPLETED.`);
      }
      throw e;
    }
  }

  async markFailed(id: string, error: any, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    try {
      await client.idempotencyRecord.update({
        where: { id },
        data: {
          status: 'FAILED',
          error,
          completedAt: new Date()
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new IdempotencyRecordDeletedError(`Idempotency record ${id} was deleted before it could be marked FAILED.`);
      }
      throw e;
    }
  }

  async markUnknown(id: string, error?: any, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    try {
      await client.idempotencyRecord.update({
        where: { id },
        data: {
          status: 'UNKNOWN',
          error,
          completedAt: new Date()
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new IdempotencyRecordDeletedError(`Idempotency record ${id} was deleted before it could be marked UNKNOWN.`);
      }
      throw e;
    }
  }

  private mapToDomain(record: any): IdempotencyRecord {
    return {
      id: record.id,
      idempotencyKey: record.idempotencyKey,
      scope: record.scope,
      requestFingerprint: record.requestFingerprint,
      status: record.status as IdempotencyStatus,
      result: record.result,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt
    };
  }
}

