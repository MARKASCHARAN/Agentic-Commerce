import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/database/prisma/prisma';
import { PrismaCatalogProvider } from '../../src/catalog/prisma-catalog.provider';
import { createInventoryCheckTool, createInventoryReserveTool } from '../../src/agent/tools/catalog/catalog.tools';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { ToolExecutionContext } from '../../src/agent/tools';

describe.sequential('Phase 29: Catalog & Inventory Commerce', () => {
  const catalogProvider = new PrismaCatalogProvider(prisma);
  const capabilityRepository = new MerchantCapabilityRepository();
  const capabilityResolver = new MerchantCapabilityResolver(capabilityRepository);
  
  const testUserId = 'test-user-inventory';
  const testMerchantId = 'merchant-inventory-test';
  const testProductId = 'prod_test_inventory_1';

  beforeAll(async () => {
    // 1. Create user, merchant, and product in DB
    await prisma.user.upsert({
      where: { email: 'inventory@merchant.com' },
      update: {},
      create: { id: testUserId, email: 'inventory@merchant.com', name: 'Inventory User' }
    });

    await prisma.merchant.upsert({
      where: { id: testMerchantId },
      update: {},
      create: { id: testMerchantId, userId: testUserId, name: 'Inventory Merchant' }
    });

    await prisma.product.upsert({
      where: { id: testProductId },
      update: { priceMinor: 1000, active: true },
      create: {
        id: testProductId,
        merchantId: testMerchantId,
        name: 'Test Product',
        priceMinor: 1000,
        currency: 'INR',
        active: true
      }
    });

    await prisma.inventory.upsert({
      where: { productId: testProductId },
      update: { quantity: 10 },
      create: {
        merchantId: testMerchantId,
        productId: testProductId,
        quantity: 10
      }
    });

    // Seed capabilities
    await capabilityRepository.setCapabilities(testMerchantId, ['inventory.check' as any, 'inventory.reserve' as any]);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.inventory.deleteMany({ where: { productId: testProductId } });
    await prisma.product.deleteMany({ where: { id: testProductId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId: testMerchantId } });
    await prisma.merchant.deleteMany({ where: { id: testMerchantId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('1. inventory.check returns correct quantity for active products', async () => {
    const registry = new ToolRegistry();
    registry.register(createInventoryCheckTool(catalogProvider));

    const gateway = new ToolGateway({
      toolRegistry: registry,
      policyEngine: { evaluate: async () => ({ status: 'ALLOW' }) } as any,
      idempotencyEngine: { execute: async (key, scope, fp, fn) => fn() } as any,
      capabilityResolver,
      eventEmitter: { emit: () => {} }
    });

    const context: ToolExecutionContext = {
      executionId: 'exec-1',
      agentId: 'agent-1',
      sessionId: 'sess-1',
      merchantId: testMerchantId
    };

    const result = await gateway.execute({
      toolId: 'inventory.check',
      input: { productId: testProductId },
      context
    });

    expect(result.output.status).toBe('success');
    expect(result.output.productId).toBe(testProductId);
    expect(result.output.quantity).toBe(10);
  });

  it('2. inventory.reserve decrements stock atomically when quantity is sufficient', async () => {
    const registry = new ToolRegistry();
    registry.register(createInventoryReserveTool(prisma));

    const gateway = new ToolGateway({
      toolRegistry: registry,
      policyEngine: { evaluate: async () => ({ status: 'ALLOW' }) } as any,
      idempotencyEngine: { execute: async (key, scope, fp, fn) => fn() } as any,
      capabilityResolver,
      eventEmitter: { emit: () => {} }
    });

    const context: ToolExecutionContext = {
      executionId: 'exec-2',
      agentId: 'agent-1',
      sessionId: 'sess-1',
      merchantId: testMerchantId
    };

    const result = await gateway.execute({
      toolId: 'inventory.reserve',
      input: { productId: testProductId, quantity: 3 },
      context
    });

    expect(result.output.status).toBe('success');
    expect(result.output.productId).toBe(testProductId);
    expect(result.output.reservedQuantity).toBe(3);
    expect(result.output.remainingQuantity).toBe(7);

    // Verify DB update
    const dbInventory = await prisma.inventory.findUnique({ where: { productId: testProductId } });
    expect(dbInventory!.quantity).toBe(7);
  });

  it('3. inventory.reserve rejects and rolls back transaction on insufficient stock', async () => {
    const registry = new ToolRegistry();
    registry.register(createInventoryReserveTool(prisma));

    const gateway = new ToolGateway({
      toolRegistry: registry,
      policyEngine: { evaluate: async () => ({ status: 'ALLOW' }) } as any,
      idempotencyEngine: { execute: async (key, scope, fp, fn) => fn() } as any,
      capabilityResolver,
      eventEmitter: { emit: () => {} }
    });

    const context: ToolExecutionContext = {
      executionId: 'exec-3',
      agentId: 'agent-1',
      sessionId: 'sess-1',
      merchantId: testMerchantId
    };

    await expect(gateway.execute({
      toolId: 'inventory.reserve',
      input: { productId: testProductId, quantity: 50 }, // exceeds current quantity (7)
      context
    })).rejects.toThrow(/Insufficient inventory/);

    // Verify DB update was NOT committed (stayed at 7)
    const dbInventory = await prisma.inventory.findUnique({ where: { productId: testProductId } });
    expect(dbInventory!.quantity).toBe(7);
  });

  it('4. ToolGateway blocks inventory.reserve for merchant lacking capability', async () => {
    // Create new merchant
    const otherMerchantId = 'merchant-lacks-inventory-reserve';
    await prisma.merchant.upsert({
      where: { id: otherMerchantId },
      update: {},
      create: { id: otherMerchantId, userId: testUserId, name: 'Lacks Capability Merchant' }
    });

    // Do NOT configure capability 'inventory.reserve'

    const registry = new ToolRegistry();
    registry.register(createInventoryReserveTool(prisma));

    const gateway = new ToolGateway({
      toolRegistry: registry,
      policyEngine: { evaluate: async () => ({ status: 'ALLOW' }) } as any,
      idempotencyEngine: { execute: async (key, scope, fp, fn) => fn() } as any,
      capabilityResolver,
      eventEmitter: { emit: () => {} }
    });

    const context: ToolExecutionContext = {
      executionId: 'exec-4',
      agentId: 'agent-1',
      sessionId: 'sess-1',
      merchantId: otherMerchantId
    };

    await expect(gateway.execute({
      toolId: 'inventory.reserve',
      input: { productId: testProductId, quantity: 1 },
      context
    })).rejects.toThrow(/Merchant lacks required capability/);

    // Clean up
    await prisma.merchant.delete({ where: { id: otherMerchantId } });
  });
});
