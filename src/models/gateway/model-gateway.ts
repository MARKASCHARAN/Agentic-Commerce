import { ModelProvider, GenerateOptions, StructuredOptions, ModelResponse, ModelStreamResponse, ModelStructuredResponse } from './types';
import { GroqAdapter } from './providers/groq/groq.adapter';
import { OpenAIAdapter } from './providers/openai/openai.adapter';
import { prisma } from '../../database/prisma/prisma';
import { isRetryableError } from './errors';
import { ModelEventEmitter } from './events';

export class ModelGateway {
  private primary: ModelProvider;
  private fallback: ModelProvider;
  public events = new ModelEventEmitter();

  constructor() {
    this.primary = this.getProvider(process.env.PRIMARY_MODEL_PROVIDER || 'groq');
    this.fallback = this.getProvider(process.env.FALLBACK_MODEL_PROVIDER || 'openai');
    this.setupDefaultTelemetry();
  }

  private getProvider(name: string): ModelProvider {
    switch (name.toLowerCase()) {
      case 'groq':
        return new GroqAdapter();
      case 'openai':
        return new OpenAIAdapter();
      default:
        throw new Error(`Unsupported model provider: ${name}`);
    }
  }

  private setupDefaultTelemetry() {
    const logToDb = async (event: any, status: string) => {
      try {
        const response = event.payload;
        if (!response || !response.usage) return;
        await prisma.modelRequest.create({
          data: {
            provider: response.provider,
            model: response.model,
            tokens_in: response.usage.promptTokens,
            tokens_out: response.usage.completionTokens,
            latency: response.latencyMs,
            status,
          },
        });
      } catch (e) {
        console.error('Failed to log model request', e);
      }
    };

    this.events.on('MODEL_REQUEST_COMPLETED', (event) => logToDb(event, 'SUCCESS'));
    this.events.on('MODEL_FALLBACK_TRIGGERED', (event) => {
      if (event.payload) {
        logToDb({ ...event, payload: event.payload }, 'FALLBACK_SUCCESS');
      }
    });
  }

  private async executeWithFallback<T>(
    operation: (provider: ModelProvider) => Promise<T>
  ): Promise<T> {
    this.events.emit({
      type: 'MODEL_REQUEST_STARTED',
      timestamp: Date.now(),
      provider: this.primary.name
    });

    try {
      const result = await operation(this.primary);
      this.events.emit({
        type: 'MODEL_REQUEST_COMPLETED',
        timestamp: Date.now(),
        provider: this.primary.name,
        payload: result
      });
      return result;
    } catch (error) {
      if (!isRetryableError(error)) {
        this.events.emit({
          type: 'MODEL_REQUEST_FAILED',
          timestamp: Date.now(),
          provider: this.primary.name,
          error
        });
        throw error;
      }

      console.warn(`Primary provider (${this.primary.name}) failed with retryable error, falling back to ${this.fallback.name}. Error:`, error);
      
      this.events.emit({
        type: 'MODEL_REQUEST_STARTED',
        timestamp: Date.now(),
        provider: this.fallback.name
      });

      try {
        const fallbackResult = await operation(this.fallback);
        this.events.emit({
          type: 'MODEL_FALLBACK_TRIGGERED',
          timestamp: Date.now(),
          provider: this.fallback.name,
          payload: fallbackResult
        });
        return fallbackResult;
      } catch (fallbackError) {
        console.error(`Fallback provider (${this.fallback.name}) also failed.`, fallbackError);
        this.events.emit({
          type: 'MODEL_REQUEST_FAILED',
          timestamp: Date.now(),
          provider: this.fallback.name,
          error: fallbackError
        });
        throw fallbackError;
      }
    }
  }

  async generate(options: GenerateOptions): Promise<ModelResponse> {
    return this.executeWithFallback((provider) => provider.generate(options));
  }

  async stream(options: GenerateOptions): Promise<ModelStreamResponse> {
    return this.executeWithFallback((provider) => provider.stream(options));
  }

  async structured<T>(options: StructuredOptions<T>): Promise<ModelStructuredResponse<T>> {
    return this.executeWithFallback((provider) => provider.structured(options));
  }

  async chat(options: import('./types').ChatOptions): Promise<import('./types').ChatResponse> {
    return this.executeWithFallback((provider) => provider.chat(options));
  }
}
