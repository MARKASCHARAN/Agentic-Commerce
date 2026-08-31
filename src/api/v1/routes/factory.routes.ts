import { Router } from 'express';
import { FactoryController } from '../controllers/factory.controller.js';

const router = Router();

router.post('/merchants', FactoryController.provisionMerchant);
router.post('/merchants/:merchantId/catalog', FactoryController.uploadCatalog);
router.post('/merchants/:merchantId/inventory', FactoryController.updateInventory);

export default router;
