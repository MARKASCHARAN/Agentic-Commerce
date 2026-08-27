import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/database/prisma/prisma';
import { AgentRepository } from '../../src/database/repositories/agent.repository';
import { SessionRepository } from '../../src/database/repositories/session.repository';
import { EventRepository } from '../../src/database/repositories/event.repository';
import { ToolCallRepository } from '../../src/database/repositories/tool-call.repository';

describe('Database Foundation', () => {
  const agentRepo = new AgentRepository();
  const sessionRepo = new SessionRepository();
  const eventRepo = new EventRepository();
  const toolCallRepo = new ToolCallRepository();

  beforeAll(async () => {
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can create agent', async () => {
    const agent = await agentRepo.create({
      owner: 'test-user',
      role: 'buyer'
    });
    expect(agent).toHaveProperty('id');
    expect(agent.owner).toBe('test-user');
    
    await agentRepo.delete(agent.id);
  });

  it('can create session, store events, store tool calls, and restore state', async () => {
    const session = await sessionRepo.create({
      state: 'START'
    });
    expect(session).toHaveProperty('id');

    const event = await eventRepo.create({
      session: { connect: { id: session.id } },
      type: 'SESSION_CREATED',
      payload: { test: true }
    });
    expect(event).toHaveProperty('id');

    const toolCall = await toolCallRepo.create({
      session: { connect: { id: session.id } },
      tool: 'search_catalog',
      input: { query: 'laptop' },
      status: 'SUCCESS'
    });
    expect(toolCall).toHaveProperty('id');

    const restored = await sessionRepo.findById(session.id);
    expect(restored).toBeDefined();
    expect(restored?.events.length).toBe(1);
    expect(restored?.tool_calls.length).toBe(1);
    expect(restored?.state).toBe('START');

    await prisma.event.delete({ where: { id: event.id } });
    await prisma.toolCall.delete({ where: { id: toolCall.id } });
    await prisma.session.delete({ where: { id: session.id } });
  });
});
