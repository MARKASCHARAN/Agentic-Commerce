import { Router } from 'express';
import factoryRoutes from './factory.routes.js';
import protocolRoutes from './protocol.routes.js';
import webhookRoutes from './webhook.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/factory', factoryRoutes);
router.use('/protocol', protocolRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/health', healthRoutes);

export default router;
