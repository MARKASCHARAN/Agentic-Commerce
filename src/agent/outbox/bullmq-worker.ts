import { Worker, Job, UnrecoverableError } from 'bullmq';
import IORedis from 'ioredis';
import { OutboxRepository, OutboxEventRecord } from '../../database/repositories/outbox.repository';
import { classifyError, calculateBackoff, FailureClass, DEFAULT_RETRY_CONFIG } from './retry-policy';

export type BullMQOutboxHandler = (event: OutboxEventRecord) => Promise<void>;

export interface BullMQWorkerConfig {
  queueName: string;
  redisUrl: string;
  concurrency: number;
}

export class BullMQOutboxWorker {
  private worker: Worker | null = null;
  private readonly handlers: Map<string, BullMQOutboxHandler> = new Map();
  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly config: BullMQWorkerConfig
  ) {}

  registerHandler(eventType: string, handler: BullMQOutboxHandler): void {
    this.handlers.set(eventType, handler);
  }

  start(): void {
    if (this.worker) return;

    this.worker = new Worker(
      this.config.queueName,
      async (job: Job) => {
        await this.processJob(job);
      },
      {
        connection: {
          url: this.config.redisUrl,
          maxRetriesPerRequest: null,
        },
        concurrency: this.config.concurrency,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            
            return calculateBackoff(attemptsMade + 1, DEFAULT_RETRY_CONFIG);
          }
        }
      }
    );

    this.worker.on('failed', (job, err) => {

    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: Job): Promise<void> {
    const { eventId, eventType, correlationId } = job.data;
    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || DEFAULT_RETRY_CONFIG.maxAttempts;

    const event = await this.outboxRepo.getByEventId(eventId);
    
    if (!event) {
      throw new UnrecoverableError(`Outbox event ${eventId} not found in database`);
    }

    const handler = this.handlers.get(eventType);
    if (!handler) {
      throw new UnrecoverableError(`No handler registered for event type: ${eventType}`);
    }

    try {
      await handler(event);
    } catch (err: any) {
      const failureClass = classifyError(err);
      
      const observabilityData = {
        eventId,
        eventType,
        correlationId,
        failureClass,
        attempt: currentAttempt,
        maxAttempts,
        error: err.message
      };

      console.error(JSON.stringify(observabilityData));

      if (failureClass === FailureClass.PERMANENT || failureClass === FailureClass.UNKNOWN) {
        
        throw new UnrecoverableError(`[${failureClass}] ${err.message}`);
      }

      throw err;
    }
  }
}
