import { Router } from 'express';
import { ProtocolController } from '../controllers/protocol.controller.js';
import { requireBuyerId } from '../../middleware/auth.js';

const router = Router();

router.use(requireBuyerId);

router.post('/requests', ProtocolController.handleRequest);
router.get('/sessions/:id', ProtocolController.getSession);
router.post('/offers/:id/counter', ProtocolController.counterOffer);
router.post('/offers/:id/accept', ProtocolController.acceptOffer);
router.post('/offers/:id/reject', ProtocolController.rejectOffer);

export default router;
