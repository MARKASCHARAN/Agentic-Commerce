import { Router } from 'express';
import factoryRoutes from './factory.routes.js';
import webhookRoutes from './webhook.routes.js';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/factory', factoryRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/health', healthRoutes);

export default router;
