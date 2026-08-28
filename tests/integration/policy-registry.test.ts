import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { 
  PolicyRegistry,
  Policy,
  PolicyId,
  PolicyContext,
  PolicyNotFoundError,
  PolicyAlreadyRegisteredError,
  PolicyValidationError
} from '../../src/agent/policy';

describe('PolicyRegistry', () => {
  let registry: PolicyRegistry;

  const mockContext: PolicyContext = {
    executionId: 'exec-1',
    sessionId: 'session-1',
    agentId: 'agent-1'
  };

  const createValidPolicy = (id: string): Policy<{ amount: number }> => ({
    metadata: {
      id: id as PolicyId,
      name: 'Test Policy',
      description: 'A test policy',
      version: '1.0.0'
    },
    inputSchema: z.object({ amount: z.number() }),
    evaluate: (input) => {
      if (input.amount > 1000) {
        return { result: 'DENY', reason: 'Amount too large' };
      }
      return { result: 'ALLOW' };
    }
  });

  beforeEach(() => {
    registry = new PolicyRegistry();
  });

  it('should successfully register and retrieve a valid policy', () => {
    const policy = createValidPolicy('test.policy.1');
    registry.register(policy);

    expect(registry.has('test.policy.1')).toBe(true);
    
    const retrieved = registry.get('test.policy.1');
    expect(retrieved.metadata.id).toBe('test.policy.1');
  });

  it('should throw PolicyAlreadyRegisteredError when registering duplicate ID', () => {
    const policy = createValidPolicy('test.duplicate');
    registry.register(policy);

    expect(() => registry.register(policy)).toThrow(PolicyAlreadyRegisteredError);
    expect(() => registry.register(policy)).toThrow(/test\.duplicate/);
  });

  it('should throw PolicyNotFoundError when retrieving unknown policy', () => {
    expect(() => registry.get('unknown.policy')).toThrow(PolicyNotFoundError);
    expect(() => registry.get('unknown.policy')).toThrow(/unknown\.policy/);
  });

  it('should return false for has() on unknown policy', () => {
    expect(registry.has('unknown.policy')).toBe(false);
  });

  it('should unregister a policy successfully', () => {
    const policy = createValidPolicy('test.unregister');
    registry.register(policy);
    expect(registry.has('test.unregister')).toBe(true);

    registry.unregister('test.unregister');
    expect(registry.has('test.unregister')).toBe(false);
  });

  it('should list all registered policy metadata without exposing internal Map', () => {
    registry.register(createValidPolicy('policy.1'));
    registry.register(createValidPolicy('policy.2'));

    const list = registry.list();
    expect(list).toHaveLength(2);
    
    const ids = list.map(p => p.id).sort();
    expect(ids).toEqual(['policy.1', 'policy.2']);

    // Ensure it's a clone/safe export by trying to mutate it
    list[0].id = 'hacked' as PolicyId;
    const cleanList = registry.list();
    expect(cleanList.find(p => p.id === 'hacked')).toBeUndefined();
  });

  describe('Validation', () => {
    it('should throw on missing metadata', () => {
      const policy: any = { inputSchema: z.any(), evaluate: () => ({ result: 'ALLOW' }) };
      expect(() => registry.register(policy)).toThrow(PolicyValidationError);
    });

    it('should throw on missing ID', () => {
      const policy = createValidPolicy('temp');
      (policy.metadata as any).id = undefined;
      expect(() => registry.register(policy)).toThrow(PolicyValidationError);
    });

    it('should throw on missing inputSchema', () => {
      const policy = createValidPolicy('test.schema');
      (policy as any).inputSchema = undefined;
      expect(() => registry.register(policy)).toThrow(PolicyValidationError);
    });

    it('should throw on missing evaluate function', () => {
      const policy = createValidPolicy('test.eval');
      (policy as any).evaluate = undefined;
      expect(() => registry.register(policy)).toThrow(PolicyValidationError);
    });
  });

  describe('Execution Contract (Manual Validation)', () => {
    it('should evaluate and return ALLOW', () => {
      const policy = createValidPolicy('test.exec');
      const decision = policy.evaluate({ amount: 500 }, mockContext);
      
      expect(decision.result).toBe('ALLOW');
      expect(decision.reason).toBeUndefined();
    });

    it('should evaluate and return DENY', () => {
      const policy = createValidPolicy('test.exec');
      const decision = policy.evaluate({ amount: 5000 }, mockContext);
      
      expect(decision.result).toBe('DENY');
      expect(decision.reason).toBe('Amount too large');
    });
  });
});
