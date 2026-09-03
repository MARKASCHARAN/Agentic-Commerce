import Redis from 'ioredis';
import { RedisConnectionError, RedisOperationError } from './errors';

export interface RedisOptions {
  url?: string;
}

export class RedisService {
  private client: Redis | null = null;
  private readonly url: string;

  constructor(options?: RedisOptions) {
    this.url = options?.url || 'redis://localhost:6379';
  }

  async connect(): Promise<void> {
    if (this.client) return;

    try {
      this.client = new Redis(this.url, {
        lazyConnect: true,
        
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) {
            return null; 
          }
          return Math.min(times * 50, 2000);
        }
      });

      await this.client.connect();
    } catch (error) {
      this.client?.disconnect();
      this.client = null;
      throw new RedisConnectionError(`Failed to connect to Redis at ${this.url}`, error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        
        this.client.disconnect();
      } finally {
        this.client = null;
      }
    }
  }

  async ping(): Promise<string> {
    this.ensureConnected();
    try {
      return await this.client!.ping();
    } catch (error) {
      throw new RedisOperationError('Failed to ping Redis', error);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.ensureConnected();
    try {
      if (ttlSeconds !== undefined) {
        await this.client!.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client!.set(key, value);
      }
    } catch (error) {
      throw new RedisOperationError(`Failed to set key ${key}`, error);
    }
  }

  async get(key: string): Promise<string | null> {
    this.ensureConnected();
    try {
      return await this.client!.get(key);
    } catch (error) {
      throw new RedisOperationError(`Failed to get key ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.client!.del(key);
    } catch (error) {
      throw new RedisOperationError(`Failed to delete key ${key}`, error);
    }
  }

  async eval<T = unknown>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
    this.ensureConnected();
    try {
      return await this.client!.eval(script, keys.length, ...keys, ...args) as T;
    } catch (error) {
      throw new RedisOperationError(`Failed to evaluate Lua script`, error);
    }
  }

  private ensureConnected(): void {
    if (!this.client || this.client.status !== 'ready') {
      throw new RedisOperationError('Redis client is not connected');
    }
  }
}
