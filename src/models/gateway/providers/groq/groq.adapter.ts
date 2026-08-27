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
    const modelId = options.model || 'llama3-8b-8192';
    
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
    const modelId = options.model || 'llama3-8b-8192';
    
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
    const modelId = options.model || 'llama3-8b-8192';
    
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
}
