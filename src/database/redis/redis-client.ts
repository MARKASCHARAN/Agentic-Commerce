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

  /**
   * Establishes connection to Redis explicitly.
   */
  async connect(): Promise<void> {
    if (this.client) return;

    try {
      this.client = new Redis(this.url, {
        lazyConnect: true,
        // Disable aggressive auto-reconnect in test/foundation phase to make failures observable
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) {
            return null; // stop retrying
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

  /**
   * Gracefully shuts down the connection.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        // Force disconnect if graceful quit fails
        this.client.disconnect();
      } finally {
        this.client = null;
      }
    }
  }

  /**
   * Pings Redis to verify connectivity.
   */
  async ping(): Promise<string> {
    this.ensureConnected();
    try {
      return await this.client!.ping();
    } catch (error) {
      throw new RedisOperationError('Failed to ping Redis', error);
    }
  }

  /**
   * Sets a key-value pair, optionally with a TTL in seconds.
   */
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

  /**
   * Gets a value by key. Returns null if not found.
   */
  async get(key: string): Promise<string | null> {
    this.ensureConnected();
    try {
      return await this.client!.get(key);
    } catch (error) {
      throw new RedisOperationError(`Failed to get key ${key}`, error);
    }
  }

  /**
   * Deletes a key.
   */
  async del(key: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.client!.del(key);
    } catch (error) {
      throw new RedisOperationError(`Failed to delete key ${key}`, error);
    }
  }

  private ensureConnected(): void {
    if (!this.client || this.client.status !== 'ready') {
      throw new RedisOperationError('Redis client is not connected');
    }
  }
}
