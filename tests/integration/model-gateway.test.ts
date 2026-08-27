import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelGateway } from '../../src/models/gateway/model-gateway';
import { GroqAdapter } from '../../src/models/gateway/providers/groq/groq.adapter';
import { OpenAIAdapter } from '../../src/models/gateway/providers/openai/openai.adapter';
import { prisma } from '../../src/database/prisma/prisma';
import { z } from 'zod';

vi.mock('../../src/database/prisma/prisma', () => ({
  prisma: {
    modelRequest: {
      create: vi.fn(),
    },
  },
}));

describe('ModelGateway', () => {
  let gateway: ModelGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new ModelGateway();
    // Mute console output during expected errors
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use primary provider (Groq) successfully', async () => {
    const mockGenerate = vi.spyOn(GroqAdapter.prototype, 'generate').mockResolvedValue({
      text: 'Hello from Groq',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 100,
      provider: 'groq',
      model: 'llama3',
    });

    const result = await gateway.generate({ prompt: 'Hi' });

    expect(result.text).toBe('Hello from Groq');
    expect(mockGenerate).toHaveBeenCalled();
    // Wait for the async event callback to trigger DB write
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(prisma.modelRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'groq', status: 'SUCCESS' }),
      })
    );
  });

  it('should fallback to secondary provider (OpenAI) if primary fails with retryable error (e.g. 429)', async () => {
    const error429 = new Error('Rate limit');
    (error429 as any).statusCode = 429;

    const mockGroqFail = vi.spyOn(GroqAdapter.prototype, 'generate').mockRejectedValue(error429);
    const mockOpenAIGenerate = vi.spyOn(OpenAIAdapter.prototype, 'generate').mockResolvedValue({
      text: 'Hello from OpenAI fallback',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 200,
      provider: 'openai',
      model: 'gpt-4o',
    });

    const result = await gateway.generate({ prompt: 'Hi' });

    expect(result.text).toBe('Hello from OpenAI fallback');
    expect(mockGroqFail).toHaveBeenCalled();
    expect(mockOpenAIGenerate).toHaveBeenCalled();
    
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(prisma.modelRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'openai', status: 'FALLBACK_SUCCESS' }),
      })
    );
  });

  it('should throw immediately and NOT fallback if primary fails with a non-retryable error (e.g. 400)', async () => {
    const error400 = new Error('Bad Request');
    (error400 as any).statusCode = 400;

    const mockGroqFail = vi.spyOn(GroqAdapter.prototype, 'generate').mockRejectedValue(error400);
    const mockOpenAIGenerate = vi.spyOn(OpenAIAdapter.prototype, 'generate');

    await expect(gateway.generate({ prompt: 'Hi' })).rejects.toThrow('Bad Request');

    expect(mockGroqFail).toHaveBeenCalled();
    expect(mockOpenAIGenerate).not.toHaveBeenCalled();
  });

  it('should throw immediately and NOT fallback on Zod validation errors', async () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'TypeValidationError';

    const mockGroqFail = vi.spyOn(GroqAdapter.prototype, 'structured').mockRejectedValue(validationError);
    const mockOpenAIFail = vi.spyOn(OpenAIAdapter.prototype, 'structured');

    await expect(
      gateway.structured({ prompt: 'Hi', schema: z.object({ id: z.string() }) })
    ).rejects.toThrow('Validation failed');

    expect(mockGroqFail).toHaveBeenCalled();
    expect(mockOpenAIFail).not.toHaveBeenCalled();
  });

  it('should throw if both primary and fallback fail (retryable)', async () => {
    const error500 = new Error('Server error');
    (error500 as any).statusCode = 500;

    const mockGroqFail = vi.spyOn(GroqAdapter.prototype, 'generate').mockRejectedValue(error500);
    const mockOpenAIFail = vi.spyOn(OpenAIAdapter.prototype, 'generate').mockRejectedValue(new Error('OpenAI also down'));

    await expect(gateway.generate({ prompt: 'Hi' })).rejects.toThrow('OpenAI also down');

    expect(mockGroqFail).toHaveBeenCalled();
    expect(mockOpenAIFail).toHaveBeenCalled();
  });

  it('should support structured output correctly', async () => {
    const fakeObject = { orderId: '123' };
    const schema = z.object({ orderId: z.string() });

    const mockStructured = vi.spyOn(GroqAdapter.prototype, 'structured').mockResolvedValue({
      object: fakeObject,
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      latencyMs: 150,
      provider: 'groq',
      model: 'llama3',
    });

    const result = await gateway.structured({ prompt: 'Extract order', schema });

    expect(result.object.orderId).toBe('123');
    expect(mockStructured).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Extract order', schema })
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(prisma.modelRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'groq', status: 'SUCCESS' }),
      })
    );
  });
});
