import { PrismaClient } from '@prisma/client';
import { IdempotencyStatus, IdempotencyRecord } from '../../agent/idempotency/types';
import { IdempotencyRecordDeletedError } from '../../agent/idempotency/errors';

export class PrismaIdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createReservation(
    key: string,
    scope: string,
    fingerprint: string
  ): Promise<IdempotencyRecord> {
    const record = await this.prisma.idempotencyRecord.create({
      data: {
        idempotencyKey: key,
        scope,
        requestFingerprint: fingerprint,
        status: 'IN_PROGRESS'
      }
    });
    console.log(`[DIAGNOSTIC] createReservation: id=${record.id}, key=${key}, scope=${scope} at ${Date.now()}`);
    return this.mapToDomain(record);
  }

  async getRecord(key: string, scope: string): Promise<IdempotencyRecord | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_idempotencyKey: {
          scope,
          idempotencyKey: key
        }
      }
    });
    console.log(`[DIAGNOSTIC] getRecord: key=${key}, scope=${scope}, found=${!!record} at ${Date.now()}`);
    return record ? this.mapToDomain(record) : null;
  }

  async markCompleted(id: string, result: any): Promise<void> {
    console.log(`[DIAGNOSTIC] markCompleted: id=${id} at ${Date.now()}`);
    try {
      await this.prisma.idempotencyRecord.update({
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

  async markFailed(id: string, error: any): Promise<void> {
    console.log(`[DIAGNOSTIC] markFailed: id=${id} at ${Date.now()}`);
    try {
      await this.prisma.idempotencyRecord.update({
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

  async markUnknown(id: string, error: any): Promise<void> {
    console.log(`[DIAGNOSTIC] markUnknown: id=${id} at ${Date.now()}`);
    try {
      await this.prisma.idempotencyRecord.update({
        where: { id },
        data: {
          status: 'UNKNOWN',
          error,
          completedAt: new Date()
        }
      });
    } catch (e: any) {
      console.log(`[DIAGNOSTIC] markUnknown ERROR for id=${id}: ${e.message}`);
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
