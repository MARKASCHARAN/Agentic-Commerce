import { Router } from 'express';
import uiRoutes from './ui.routes.js';
import legacyProtocolRoutes from './legacy-protocol.routes.js';

const router = Router();

router.use('/', uiRoutes);
router.use('/protocol', legacyProtocolRoutes);

export default router;
