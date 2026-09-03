import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/razorpay', WebhookController.handleRazorpay);

export default router;
