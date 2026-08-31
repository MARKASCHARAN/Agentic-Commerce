import express from "express";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { env } from "../config/env.js";
import v1Routes from "./v1/routes/index.js";
import internalRoutes from "./internal/routes/index.js";
import { BullMQOutboxWorker } from "../agent/outbox/bullmq-worker.js";
import { OutboxRepository } from "../database/repositories/outbox.repository.js";
import { createPaymentReconciliationHandler } from "../agent/payments/reconciliation.js";
import { PrismaClient } from "@prisma/client";
import { OutboxPublisher } from "../agent/outbox/publisher.js";
import { Queue } from "bullmq";

const app = express();
const prisma = new PrismaClient();

app.use('/v1/webhooks/razorpay', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/v1', v1Routes);
app.use('/internal', internalRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.server.port, env.server.host, () => {
  console.log(
    `Agentic Commerce API running on http://${env.server.host}:${env.server.port}`
  );

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