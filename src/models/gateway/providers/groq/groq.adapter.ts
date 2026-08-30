import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText, generateObject } from 'ai';
import { ModelProvider, GenerateOptions, StructuredOptions, ModelResponse, ModelStreamResponse, ModelStructuredResponse } from '../../types';

export class GroqAdapter implements ModelProvider {
  name = 'groq';
  private groq;

  constructor() {
    this.groq = createGroq({
      apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    });
  }

  async generate(options: GenerateOptions): Promise<ModelResponse> {
    const startTime = Date.now();
    const modelId = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    
    const result = await generateText({
      model: this.groq(modelId),
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
      // @ts-ignore
      maxTokens: options.maxTokens,
    });

    return {
      text: result.text,
      usage: {
        // @ts-ignore
        promptTokens: result.usage.promptTokens ?? (result.usage as any).inputTokens ?? 0,
        // @ts-ignore
        completionTokens: result.usage.completionTokens ?? (result.usage as any).outputTokens ?? 0,
        // @ts-ignore
        totalTokens: result.usage.totalTokens ?? ((result.usage as any).inputTokens || 0) + ((result.usage as any).outputTokens || 0),
      },
      latencyMs: Date.now() - startTime,
      provider: this.name,
      model: modelId,
    };
  }

  async stream(options: GenerateOptions): Promise<ModelStreamResponse> {
    const modelId = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    
    const result = await streamText({
      model: this.groq(modelId),
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
      // @ts-ignore
      maxTokens: options.maxTokens,
    });

    return {
      stream: result.textStream,
      provider: this.name,
      model: modelId,
    };
  }

  async structured<T>(options: StructuredOptions<T>): Promise<ModelStructuredResponse<T>> {
    const startTime = Date.now();
    const modelId = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    
    const result = await generateObject({
      model: this.groq(modelId),
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
      schema: options.schema,
      schemaName: options.schemaName,
      schemaDescription: options.schemaDescription,
    });

    return {
      object: result.object,
      usage: {
        // @ts-ignore
        promptTokens: result.usage.promptTokens ?? (result.usage as any).inputTokens ?? 0,
        // @ts-ignore
        completionTokens: result.usage.completionTokens ?? (result.usage as any).outputTokens ?? 0,
        // @ts-ignore
        totalTokens: result.usage.totalTokens ?? ((result.usage as any).inputTokens || 0) + ((result.usage as any).outputTokens || 0),
      },
      latencyMs: Date.now() - startTime,
      provider: this.name,
      model: modelId,
    };
  }

  async chat(options: import('../../types').ChatOptions): Promise<import('../../types').ChatResponse> {
    const startTime = Date.now();
    const modelId = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    
    let result;
    try {
      result = await generateText({
        model: this.groq(modelId),
        messages: options.messages as any,
        system: options.system,
        temperature: options.temperature,
        // @ts-ignore
        maxTokens: options.maxTokens,
        tools: options.tools,
        maxSteps: options.maxSteps || 1
      });
    } catch (err: any) {
      if (err?.statusCode === 429 || err?.status === 429 || String(err?.message).includes('Rate limit')) {
        const fallbackModelId = 'openai/gpt-oss-20b';
        console.warn(`Groq primary model ${modelId} rate limited, retrying with ${fallbackModelId}...`);
        result = await generateText({
          model: this.groq(fallbackModelId),
          messages: options.messages as any,
          system: options.system,
          temperature: options.temperature,
          // @ts-ignore
          maxTokens: options.maxTokens,
          tools: options.tools,
          maxSteps: options.maxSteps || 1
        });
      } else {
        throw err;
      }
    }

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      usage: {
        // @ts-ignore
        promptTokens: result.usage?.promptTokens ?? (result.usage as any)?.inputTokens ?? 0,
        // @ts-ignore
        completionTokens: result.usage?.completionTokens ?? (result.usage as any)?.outputTokens ?? 0,
        // @ts-ignore
        totalTokens: result.usage?.totalTokens ?? ((result.usage as any)?.inputTokens || 0) + ((result.usage as any)?.outputTokens || 0),
      },
      latencyMs: Date.now() - startTime,
      provider: this.name,
      model: modelId,
    };
  }
}
