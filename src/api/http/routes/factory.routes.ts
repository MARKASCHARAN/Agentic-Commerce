import { Router } from 'express';
import { FactoryController } from '../controllers/factory.controller.js';
import { FactoryMerchantController } from '../controllers/factory.merchant.controller.js';
import { FactoryCatalogController } from '../controllers/factory.catalog.controller.js';
import { FactoryInventoryController } from '../controllers/factory.inventory.controller.js';
import { FactoryPoliciesController } from '../controllers/factory.policies.controller.js';
import { FactoryAgentController } from '../controllers/factory.agent.controller.js';
import { FactoryLifecycleController } from '../controllers/factory.lifecycle.controller.js';
import { FactoryCommerceController } from '../controllers/factory.commerce.controller.js';
import { FactoryRevenueController } from '../controllers/factory.revenue.controller.js';
import { FactoryAuditController } from '../controllers/factory.audit.controller.js';
import { merchantAuthMiddleware } from '../middleware/merchant-auth.js';
import { userAuthMiddleware } from '../middleware/user-auth.js';

const router = Router();

// Apply user auth middleware for global merchant listing and provisioning
router.use('/merchants', userAuthMiddleware);

// Existing onboarding route (public for new merchants)
router.post('/merchants', FactoryController.provisionMerchant);

// New lifecycle routes
router.get('/merchants', FactoryMerchantController.listMerchants);
router.get('/merchants/draft', FactoryMerchantController.getDraftMerchant);

// Apply auth middleware to all merchant-scoped routes
const scopedRouter = Router({ mergeParams: true });
scopedRouter.use(merchantAuthMiddleware);

// Merchant Lifecycle
scopedRouter.get('/', FactoryMerchantController.getMerchant);
scopedRouter.patch('/', FactoryMerchantController.updateMerchant);
scopedRouter.delete('/', FactoryMerchantController.deleteMerchant);

// Catalog CRUD
scopedRouter.get('/products', FactoryCatalogController.listProducts);
scopedRouter.post('/products', FactoryCatalogController.createProduct);
scopedRouter.get('/products/:productId', FactoryCatalogController.getProduct);
scopedRouter.patch('/products/:productId', FactoryCatalogController.updateProduct);
scopedRouter.delete('/products/:productId', FactoryCatalogController.deleteProduct);

// Inventory CRUD
scopedRouter.get('/inventory', FactoryInventoryController.getInventory);
scopedRouter.patch('/products/:productId/inventory', FactoryInventoryController.updateInventory);

// Policies & Capabilities
scopedRouter.get('/guardrails', FactoryPoliciesController.getGuardrails);
scopedRouter.patch('/guardrails', FactoryPoliciesController.updateGuardrails);
scopedRouter.get('/capabilities', FactoryPoliciesController.getCapabilities);
scopedRouter.patch('/capabilities', FactoryPoliciesController.updateCapabilities);

// Agent Provisioning
scopedRouter.get('/agent', FactoryAgentController.getAgent);
scopedRouter.post('/agent', FactoryAgentController.provisionAgent);
scopedRouter.post('/agent/rotate', FactoryAgentController.rotateCredential);

// Commerce (Orders & Payments)
scopedRouter.get('/orders', FactoryCommerceController.listOrders);
scopedRouter.get('/payments', FactoryCommerceController.listPayments);

// Revenue
scopedRouter.get('/opportunities', FactoryRevenueController.listOpportunities);

// Audit
scopedRouter.get('/audit', FactoryAuditController.listEvents);

// Validation & Lifecycle
scopedRouter.get('/validate', FactoryLifecycleController.validate);
scopedRouter.post('/publish', FactoryLifecycleController.publish);
scopedRouter.post('/pause', FactoryLifecycleController.pause);
scopedRouter.post('/resume', FactoryLifecycleController.resume);

// Existing legacy endpoints
scopedRouter.post('/catalog', FactoryController.uploadCatalog);
scopedRouter.post('/inventory', FactoryController.updateInventory);

router.use('/merchants/:merchantId', scopedRouter);

export default router;
