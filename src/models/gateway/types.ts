import { z } from 'zod';

export interface ModelProvider {
  name: string;
  generate(options: GenerateOptions): Promise<ModelResponse>;
  stream(options: GenerateOptions): Promise<ModelStreamResponse>;
  structured<T>(options: StructuredOptions<T>): Promise<ModelStructuredResponse<T>>;
  chat(options: ChatOptions): Promise<ChatResponse>;
}

export interface GenerateOptions {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredOptions<T> extends GenerateOptions {
  schema: z.Schema<T>;
  schemaName?: string;
  schemaDescription?: string;
}

export interface ModelResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  provider: string;
  model: string;
}

export interface ModelStreamResponse {
  stream: AsyncIterable<string>;
  provider: string;
  model: string;
}

export interface ModelStructuredResponse<T> {
  object: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  provider: string;
  model: string;
}

export interface ChatOptions {
  messages: any[]; // Vercel AI SDK CoreMessage[]
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Record<string, any>;
  maxSteps?: number;
}

export interface ChatResponse {
  text: string;
  toolCalls?: any[];
  toolResults?: any[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  provider: string;
  model: string;
}
