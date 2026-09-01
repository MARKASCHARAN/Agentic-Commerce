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
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/v1', v1Routes);
app.use('/api', v1Routes); // Support Razorpay dashboard pointing to /api
app.use('/internal', internalRoutes);

app.get('/pay/:orderId', (req, res) => {
  const razorpayOrderId = req.params.orderId;
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_fallback';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Agentic Commerce - Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9f9f9; flex-direction: column; }
    h1 { color: #333; }
    p { color: #666; margin-bottom: 2rem; }
    button { background-color: #528FF0; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 6px; cursor: pointer; transition: background-color 0.2s; }
    button:hover { background-color: #3b76d6; }
    .loader { border: 4px solid #f3f3f3; border-top: 4px solid #528FF0; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin-bottom: 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loader" class="loader"></div>
  <h1 id="title">Initializing Payment...</h1>
  <p id="subtitle">Please wait while we open the secure payment gateway.</p>
  <button id="retry-btn" style="display: none;" onclick="openRazorpay()">Retry Payment</button>

  <script>
    var options = {
      "key": "${razorpayKeyId}",
      "order_id": "${razorpayOrderId}",
      "name": "Agentic Commerce",
      "description": "Dummy Order Payment",
      "handler": function (response){
        document.getElementById('loader').style.display = 'none';
        document.getElementById('title').innerText = 'Payment Successful! 🎉';
        document.getElementById('title').style.color = '#28a745';
        document.getElementById('subtitle').innerText = 'Your payment has been processed. You can close this window now and return to the chat.';
        document.getElementById('retry-btn').style.display = 'none';
      },
      "modal": {
        "ondismiss": function(){
          document.getElementById('loader').style.display = 'none';
          document.getElementById('title').innerText = 'Payment Cancelled';
          document.getElementById('subtitle').innerText = 'You closed the payment window. Click the button below to try again.';
          document.getElementById('retry-btn').style.display = 'block';
        }
      }
    };
    
    var rzp1 = new Razorpay(options);
    
    function openRazorpay() {
      document.getElementById('loader').style.display = 'block';
      document.getElementById('title').innerText = 'Opening Gateway...';
      document.getElementById('subtitle').innerText = 'Please complete the payment in the popup.';
      document.getElementById('retry-btn').style.display = 'none';
      rzp1.open();
    }

    // Auto-open on load
    window.onload = function() {
      openRazorpay();
    };
  </script>
</body>
</html>
  `;
  res.send(html);
});

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