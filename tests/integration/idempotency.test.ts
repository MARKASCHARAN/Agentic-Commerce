import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { IdempotencyEngine } from '../../src/agent/idempotency/engine';
import { 
  IdempotencyConflictError, 
  IdempotencyInProgressError, 
  IdempotencyUnknownError,
  generateRequestFingerprint
} from '../../src/agent/idempotency';
import { randomUUID } from 'crypto';

describe('Idempotency Engine Integration', () => {
  let prisma: PrismaClient;
  let repo: PrismaIdempotencyRepository;
  let engine: IdempotencyEngine;

  beforeEach(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    repo = new PrismaIdempotencyRepository(prisma);
    engine = new IdempotencyEngine(repo);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Fingerprinting', () => {
    it('should generate identical fingerprints for logically equivalent objects', () => {
      const obj1 = { merchantId: 'm1', amount: 500, currency: 'INR' };
      const obj2 = { currency: 'INR', merchantId: 'm1', amount: 500 };
      
      const fp1 = generateRequestFingerprint(obj1);
      const fp2 = generateRequestFingerprint(obj2);
      
      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for materially different objects', () => {
      const obj1 = { amount: 500 };
      const obj2 = { amount: 5000 };
      
      const fp1 = generateRequestFingerprint(obj1);
      const fp2 = generateRequestFingerprint(obj2);
      
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('Core Execution & Atomicity', () => {
    it('should successfully execute and cache the result', async () => {
      const key = randomUUID();
      const scope = 'payment';
      const input = { amount: 100 };
      
      let executionCount = 0;
      const op = async () => {
        executionCount++;
        return { success: true };
      };

      const result1 = await engine.execute(key, scope, input, op);
      expect(result1).toEqual({ success: true });
      expect(executionCount).toBe(1);

      const result2 = await engine.execute(key, scope, input, op);
      expect(result2).toEqual({ success: true });
      expect(executionCount).toBe(1); 
    });

    it('should reject same key with different fingerprint', async () => {
      const key = randomUUID();
      const scope = 'payment';

      await engine.execute(key, scope, { amount: 100 }, async () => ({ success: true }));

      await expect(
        engine.execute(key, scope, { amount: 5000 }, async () => ({}))
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it('should handle 100 concurrent requests with exactly ONE owner', async () => {
      const key = randomUUID();
      const scope = 'concurrent-test';
      const input = { data: 'test' };

      let executionCount = 0;
      const op = async () => {
        executionCount++;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true };
      };

      const reqs = Array.from({ length: 100 }).map(() => engine.execute(key, scope, input, op));
      
      const results = await Promise.allSettled(reqs);

      const successes = results.filter(r => r.status === 'fulfilled');
      const inProgressFailures = results.filter(
        r => r.status === 'rejected' && r.reason instanceof IdempotencyInProgressError
      );

      expect(executionCount).toBe(1); 
      expect(successes.length + inProgressFailures.length).toBe(100);
      expect(successes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Crash Recovery & Error Handling', () => {
    it('should mark unretryable errors as FAILED', async () => {
      const key = randomUUID();
      const scope = 'payment';
      const input = {};

      const op = async () => {
        const err = new Error('Validation Failed');
        err.name = 'ToolValidationError'; 
        throw err;
      };

      await expect(engine.execute(key, scope, input, op)).rejects.toThrow('Validation Failed');

      await expect(engine.execute(key, scope, input, async () => ({}))).rejects.toThrow(IdempotencyConflictError);
    });

    it('should mark network errors as UNKNOWN (crash recovery window)', async () => {
      const key = randomUUID();
      const scope = 'payment';
      const input = {};

      const op = async () => {
        throw new Error('Connection Reset'); 
      };

      await expect(engine.execute(key, scope, input, op)).rejects.toThrow('Connection Reset');

      await expect(engine.execute(key, scope, input, async () => ({}))).rejects.toThrow(IdempotencyUnknownError);
    });
    
    it('should mark stale IN_PROGRESS records as UNKNOWN', async () => {
      const key = randomUUID();
      const scope = 'payment';
      const input = { a: 1 };

      const fingerprint = generateRequestFingerprint(input);
      const staleRecord = await repo.createReservation(key, scope, fingerprint);

      await prisma.idempotencyRecord.update({
        where: { id: staleRecord.id },
        data: { createdAt: new Date(Date.now() - 6 * 60 * 1000) }
      });

      await expect(engine.execute(key, scope, input, async () => ({}))).rejects.toThrow(IdempotencyUnknownError);
    });
  });
});
