import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { prisma } from '../../src/database/prisma/prisma';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
import { SkillLoader } from '../../src/agent/skills/skill-loader';
import { SkillRegistry } from '../../src/agent/skills/skill-registry';
import { ModelGateway } from '../../src/models/gateway/model-gateway';
import { ToolGateway } from '../../src/agent/tools';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { PolicyRegistry } from '../../src/agent/policy/policy-registry';

describe.sequential('Phase 24: Merchant Identity + Dynamic Capabilities', () => {
  const repo = new MerchantCapabilityRepository();
  const resolver = new MerchantCapabilityResolver(repo);
  const rootSkillsDir = path.resolve(__dirname, '../../skills');
  let registry: SkillRegistry;

  const testUserId = 'test-user-merchant-capabilities';
  const merchantA = 'merchant-a-capabilities';
  const merchantB = 'merchant-b-capabilities';

  beforeAll(async () => {
    // Setup test DB state
    await prisma.user.upsert({
      where: { email: 'test@merchants.com' },
      update: {},
      create: { id: testUserId, email: 'test@merchants.com', name: 'Test User' }
    });

    await prisma.merchant.upsert({
      where: { id: merchantA },
      update: {},
      create: { id: merchantA, userId: testUserId, name: 'Merchant A' }
    });

    await prisma.merchant.upsert({
      where: { id: merchantB },
      update: {},
      create: { id: merchantB, userId: testUserId, name: 'Merchant B' }
    });

    // Merchant A: "catalog", "inventory", "payment.create"
    await repo.setCapabilities(merchantA, ['catalog' as any, 'inventory' as any, 'payment.create' as any]);

    // Merchant B: "subscriptions", "payment.create"
    await repo.setCapabilities(merchantB, ['subscriptions' as any, 'payment.create' as any]);

    const loader = new SkillLoader(rootSkillsDir);
    registry = new SkillRegistry();
    await registry.discoverAndRegister(rootSkillsDir, loader);
  });

  afterAll(async () => {
    await prisma.merchantCapability.deleteMany({ where: { merchantId: { in: [merchantA, merchantB] } } });
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantA, merchantB] } } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('1. Merchant identity resolves correctly and capabilities are isolated', async () => {
    const capsA = await resolver.resolve(merchantA);
    expect(capsA.has('catalog' as any)).toBe(true);
    expect(capsA.has('payment.create' as any)).toBe(true);
    expect(capsA.has('subscriptions' as any)).toBe(false);

    const capsB = await resolver.resolve(merchantB);
    expect(capsB.has('subscriptions' as any)).toBe(true);
    expect(capsB.has('catalog' as any)).toBe(false);

    // Ensure they don't leak
    const allA = capsA.getAll();
    const allB = capsB.getAll();
    expect(allA).not.toEqual(allB);
  });

  it('2. Capabilities dynamically determine available skills without merchantType branching', async () => {
    const allSkills = registry.list();
    
    const getAvailable = async (merchantId: string) => {
      const caps = await resolver.resolve(merchantId);
      return allSkills.filter(skill => {
        if (!skill.requiredCapabilities || skill.requiredCapabilities.length === 0) return true;
        return skill.requiredCapabilities.every(cap => caps.has(cap as any));
      }).map(s => s.name);
    };

    const skillsA = await getAvailable(merchantA);
    const skillsB = await getAvailable(merchantB);

    // product-search requires catalog.read and inventory.read
    expect(skillsA).toContain('product-search');
    expect(skillsB).not.toContain('product-search');

    // subscription-upgrade requires subscription.read and subscription.upgrade
    expect(skillsB).toContain('subscription-upgrade');
    expect(skillsA).not.toContain('subscription-upgrade');

    // payment requires payment.create
    expect(skillsA).toContain('payment');
    expect(skillsB).toContain('payment');
  });

  it('3. Missing merchant identity fails safely (empty capabilities)', async () => {
    const caps = await resolver.resolve('nonexistent-merchant');
    expect(caps.getAll()).toEqual([]);
  });

  it('4. Runtime routes explicit merchant identity to capabilities', async () => {
    // Setup a lightweight runtime to test skill availability evaluation
    const mockModel: ModelGateway = {
      invoke: async () => ({ text: 'mock', usage: { totalTokens: 1 } }),
      structured: async (params: any) => {
        // Assert that the prompt contains the right available skills
        expect(params.prompt).toContain('product-search');
        expect(params.prompt).not.toContain('subscription-upgrade');
        return { 
          object: { type: 'FINAL_RESPONSE', payload: { text: 'ok' } }, 
          usage: { totalTokens: 1 } 
        };
      }
    };

    const stateManager = {
      createExecution: async () => {},
      saveState: async () => {},
      loadContext: async () => ({
        identity: { sessionId: '1', executionId: '1' },
        task: 'test',
        conversation: { messages: [] },
        runtimeMetadata: {},
        scopedData: {} // Empty scoped data, but we provide merchantId via identity
      })
    };

    const runtime = new AgentRuntime({
      modelGateway: mockModel,
      stateManager,
      toolGateway: new ToolGateway(new PolicyEngine(new PolicyRegistry()), null as any),
      skillSelector: { selectSkill: async () => null },
      skillRegistry: registry,
      eventEmitter: { emit: () => {} },
      capabilityResolver: resolver
    });

    const identity = { sessionId: '1', executionId: '1', merchantId: merchantA };
    await runtime.execute(identity, 'test task');
  });
});
