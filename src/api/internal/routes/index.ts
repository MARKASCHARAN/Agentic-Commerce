import { Router } from 'express';
import uiRoutes from './ui.routes.js';

const router = Router();

router.use('/', uiRoutes);

export default router;
