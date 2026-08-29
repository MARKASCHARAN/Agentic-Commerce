import express from "express";
import routes from "./routes/index.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { env } from "../config/env.js";
import webhookRoutes from "./routes/webhooks.js";
import { BullMQOutboxWorker } from "../agent/outbox/bullmq-worker.js";
import { OutboxRepository } from "../database/repositories/outbox.repository.js";
import { createPaymentReconciliationHandler } from "../agent/payments/reconciliation.js";
import { PrismaClient } from "@prisma/client";
import { OutboxPublisher } from "../agent/outbox/publisher.js";
import { Queue } from "bullmq";

const app = express();
const prisma = new PrismaClient();

// The Razorpay webhook requires the raw body string to verify the HMAC signature.
// We must parse it as raw bytes BEFORE the global express.json() destroys it.
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/api/webhooks', webhookRoutes);
app.use(routes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.server.port, env.server.host, () => {
  console.log(
    `Agentic Commerce API running on http://${env.server.host}:${env.server.port}`,
  );

  // Start BullMQ Worker
  const outboxRepo = new OutboxRepository(prisma);
  const queueName = 'agentic-commerce-outbox';
  const redisUrl = env.redis.url || 'redis://localhost:6379';

  const worker = new BullMQOutboxWorker(outboxRepo, {
    queueName,
    redisUrl,
    concurrency: 5
  });

  worker.registerHandler('payment.webhook', createPaymentReconciliationHandler(prisma));
  worker.start();
  console.log('BullMQ Outbox Worker started');

  const bullQueue = new Queue(queueName, { connection: { url: redisUrl } });
  const publisher = new OutboxPublisher(outboxRepo, bullQueue);
  publisher.start();
  console.log('Outbox Publisher started');
});