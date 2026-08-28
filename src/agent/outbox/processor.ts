import { PrismaClient } from '@prisma/client';
import { OutboxRepository, OutboxEventRecord } from '../../database/repositories/outbox.repository';

export type OutboxHandler = (event: OutboxEventRecord) => Promise<void>;

export interface OutboxProcessorConfig {
  batchSize: number;
  pollIntervalMs: number;
  staleTimeoutMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
}

const DEFAULT_CONFIG: OutboxProcessorConfig = {
  batchSize: 10,
  pollIntervalMs: 1000,
  staleTimeoutMs: 5 * 60 * 1000,
  maxAttempts: 5,
  backoffBaseMs: 1000,
};

export class OutboxProcessor {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: OutboxProcessorConfig;
  private readonly handlers: Map<string, OutboxHandler> = new Map();

  constructor(
    private readonly outboxRepo: OutboxRepository,
    config?: Partial<OutboxProcessorConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerHandler(eventType: string, handler: OutboxHandler): void {
    this.handlers.set(eventType, handler);
  }

  async start(): Promise<void> {
    this.running = true;
    await this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<number> {
    await this.outboxRepo.resetStaleProcessing(this.config.staleTimeoutMs);

    const events = await this.outboxRepo.claimNext(this.config.batchSize);
    if (events.length === 0) return 0;

    let processed = 0;
    for (const event of events) {
      await this.processEvent(event);
      processed++;
    }
    return processed;
  }

  private async processEvent(event: OutboxEventRecord): Promise<void> {
    const handler = this.handlers.get(event.eventType);
    if (!handler) {
      await this.outboxRepo.markFailed(event.id, {
        reason: `No handler registered for event type: ${event.eventType}`,
      });
      return;
    }

    try {
      await handler(event);
      await this.outboxRepo.markDelivered(event.id);
    } catch (err: any) {
      if (event.attempts >= this.config.maxAttempts) {
        await this.outboxRepo.markFailed(event.id, {
          reason: err.message || 'Unknown error',
          attempt: event.attempts,
        });
      } else {
        const backoffMs = this.config.backoffBaseMs * Math.pow(2, event.attempts - 1);
        await this.outboxRepo.markPendingRetry(event.id, backoffMs, {
          reason: err.message || 'Unknown error',
          attempt: event.attempts,
        });
      }
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.tick();
      } catch (_err) {
      }

      if (!this.running) break;
      await new Promise<void>((resolve) => {
        this.timer = setTimeout(resolve, this.config.pollIntervalMs);
      });
    }
  }
}
