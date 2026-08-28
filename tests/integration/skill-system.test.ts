import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillLoader } from '../../src/agent/skills/skill-loader';
import { SkillRegistry } from '../../src/agent/skills/skill-registry';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
import { SkillDefinitionError, SkillFileNotFoundError } from '../../src/agent/skills/errors';

describe.sequential('Phase 22: Dynamic Skill System', () => {
  const rootSkillsDir = path.resolve(__dirname, '../../skills');
  const tempSkillsDir = path.resolve(__dirname, '../../skills-test-temp');

  let loader: SkillLoader;
  let registry: SkillRegistry;
  let capabilityResolver: MerchantCapabilityResolver;

  beforeAll(async () => {
    loader = new SkillLoader(rootSkillsDir);
    registry = new SkillRegistry();
    capabilityResolver = new MerchantCapabilityResolver();
    
    // Setup a temp directory for some destructive/malformed tests
    await fs.mkdir(tempSkillsDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempSkillsDir, { recursive: true, force: true });
  });

  it('1. should dynamically discover SKILL.md files from skills directory', async () => {
    const discovered = await loader.discover(rootSkillsDir);
    expect(discovered.length).toBeGreaterThanOrEqual(11);
    
    // Check for some known skills
    const negotiationPath = path.join(rootSkillsDir, 'negotiation', 'SKILL.md');
    expect(discovered).toContain(negotiationPath);
  });

  it('2. should correctly parse frontmatter metadata from SKILL.md', async () => {
    const negotiationPath = path.join(rootSkillsDir, 'negotiation', 'SKILL.md');
    const def = await loader.loadFromFile(negotiationPath);
    
    expect(def.name).toBe('negotiation');
    expect(def.description).toContain('Negotiate');
    expect(def.requiredCapabilities).toContain('quote.create');
    expect(def.requiredCapabilities).toContain('negotiation.create');
    expect(def.instructions).toContain('Never invent a price');
  });

  it('3. should reject malformed SKILL.md missing metadata', async () => {
    const badSkillDir = path.join(tempSkillsDir, 'bad-skill');
    await fs.mkdir(badSkillDir, { recursive: true });
    
    const badSkillPath = path.join(badSkillDir, 'SKILL.md');
    await fs.writeFile(badSkillPath, `---
name: incomplete
---
# Missing description
`);

    const tempLoader = new SkillLoader(tempSkillsDir);
    await expect(tempLoader.loadFromFile(badSkillPath)).rejects.toThrowError(/Missing required metadata/);
  });

  it('4. should reject path traversal attempts', async () => {
    const traversalPath = path.join(rootSkillsDir, '../../../../etc/passwd');
    await expect(loader.loadFromFile(traversalPath)).rejects.toThrowError(/Path traversal detected/);
  });

  it('5. should load and register all valid skills dynamically into registry', async () => {
    await registry.discoverAndRegister(rootSkillsDir, loader);
    const registered = registry.list();
    
    expect(registered.length).toBeGreaterThanOrEqual(11);
    expect(registry.has('payment')).toBe(true);
    expect(registry.has('upsell')).toBe(true);
  });

  it('6. capability filtering should correctly identify available skills for a D2C merchant', async () => {
    // D2C merchant has catalog.read, inventory.read, payment.create, order.create, checkout.create, refund.create, upsell.create, cross_sell.create, pricing
    // We expect them to get product-search, checkout, payment, refund, upsell, abandoned-cart-recovery, repeat-purchase, cross-sell
    const capabilities = await capabilityResolver.resolve('merchant-d2c');
    
    const allSkills = registry.list();
    const availableSkills = allSkills.filter(skill => {
      if (!skill.requiredCapabilities || skill.requiredCapabilities.length === 0) return true;
      return skill.requiredCapabilities.every(cap => capabilities.has(cap as any));
    });

    const skillNames = availableSkills.map(s => s.name);
    expect(skillNames).toContain('product-search');
    expect(skillNames).toContain('payment');
    expect(skillNames).toContain('upsell');
    // D2C doesn't have negotiation.create or quote.create, so they shouldn't get negotiation
    expect(skillNames).not.toContain('negotiation');
  });

  it('7. capability filtering should correctly identify available skills for a B2B merchant', async () => {
    // B2B merchant has quote.create, negotiation.create
    const capabilities = await capabilityResolver.resolve('merchant-b2b');
    
    const allSkills = registry.list();
    const availableSkills = allSkills.filter(skill => {
      if (!skill.requiredCapabilities || skill.requiredCapabilities.length === 0) return true;
      return skill.requiredCapabilities.every(cap => capabilities.has(cap as any));
    });

    const skillNames = availableSkills.map(s => s.name);
    expect(skillNames).toContain('quote');
    expect(skillNames).toContain('negotiation');
    expect(skillNames).toContain('checkout'); 
  });

  it('8. runtime skill routing should securely fail if skill is unavailable', async () => {
    // We mock AgentRuntime dependencies to test routing
    const mockModelGateway = {
      structured: async () => ({
        object: {
          type: 'SKILL_REQUEST',
          payload: { skillName: 'negotiation', intent: {} }
        },
        usage: { totalTokens: 10 }
      })
    } as any;

    const runtime = new AgentRuntime({
      modelGateway: mockModelGateway,
      stateManager: {
        createExecution: async () => {},
        saveState: async () => {},
        loadContext: async () => ({ task: 'test', runtimeMetadata: {}, conversation: { messages: [] }, scopedData: {} })
      } as any,
      toolGateway: {} as any,
      skillSelector: {} as any,
      skillRegistry: registry,
      eventEmitter: { emit: () => {} },
      capabilityResolver
    });

    // merchant-d2c does NOT have negotiation capability
    const identity = { sessionId: '1', executionId: '1', userId: 'merchant-d2c', agentId: 'agent-1' };
    
    await expect(runtime.execute(identity, 'test')).rejects.toThrowError(/not available or not permitted/);
  });
  
  it('9. runtime skill routing should route to ToolGateway for payment skill', async () => {
    let capturedToolId = '';
    const mockToolGateway = {
      execute: async (req: any) => {
        capturedToolId = req.toolId;
        return { output: { status: 'success' } };
      }
    } as any;

    const mockModelGateway = {
      structured: async () => ({
        object: {
          type: 'SKILL_REQUEST',
          payload: { skillName: 'payment', intent: { amount: 100 } }
        },
        usage: { totalTokens: 10 }
      })
    } as any;

    const runtime = new AgentRuntime({
      modelGateway: mockModelGateway,
      stateManager: {
        createExecution: async () => {},
        saveState: async () => {},
        loadContext: async () => ({ task: 'test', runtimeMetadata: {}, conversation: { messages: [] }, scopedData: {} })
      } as any,
      toolGateway: mockToolGateway,
      skillSelector: {} as any,
      skillRegistry: registry,
      eventEmitter: { emit: () => {} },
      capabilityResolver
    });

    // merchant-d2c has payment capability
    const identity = { sessionId: '2', executionId: '2', userId: 'merchant-d2c', agentId: 'agent-1' };
    
    const result = await runtime.execute(identity, 'test');
    expect(result.action).toBe('SKILL_REQUEST');
    expect(result.payload.skillName).toBe('payment');
    // Ensure the execution was routed to the ToolGateway safely
    expect(capturedToolId).toBe('capture_payment');
  });
});
