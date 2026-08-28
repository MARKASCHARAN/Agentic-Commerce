import { Queue } from 'bullmq';
import { OutboxRepository, OutboxEventRecord } from '../../database/repositories/outbox.repository';

import { DEFAULT_RETRY_CONFIG } from './retry-policy';

export interface OutboxPublisherConfig {
  batchSize: number;
  pollIntervalMs: number;
  staleTimeoutMs: number;
}

const DEFAULT_CONFIG: OutboxPublisherConfig = {
  batchSize: 10,
  pollIntervalMs: 1000,
  staleTimeoutMs: 5 * 60 * 1000,
};

export class OutboxPublisher {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: OutboxPublisherConfig;

  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly bullQueue: Queue,
    config?: Partial<OutboxPublisherConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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
      await this.publishEvent(event);
      processed++;
    }
    return processed;
  }

  private async publishEvent(event: OutboxEventRecord): Promise<void> {
    try {

      await this.bullQueue.add(
        event.eventType,
        {
          eventId: event.eventId,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          correlationId: event.correlationId,
        },
        {
          jobId: event.eventId, 
          attempts: DEFAULT_RETRY_CONFIG.maxAttempts, 
          backoff: { type: 'custom' },
        }
      );

      await this.outboxRepo.markDelivered(event.id);
    } catch (err: any) {

      console.error(`Failed to publish event ${event.eventId} to BullMQ:`, err);
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
