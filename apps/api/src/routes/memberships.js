import { Router } from 'express';
import * as membershipController from '../controllers/membershipController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/plans', membershipController.listPlans);
router.get('/plans/:id', membershipController.getPlan);
router.post('/plans', authenticate, authorize('owner'), membershipController.createPlan);
router.put('/plans/:id', authenticate, authorize('owner'), membershipController.updatePlan);

router.get('/', authenticate, membershipController.listMemberships);
router.post('/', authenticate, authorize('client'), membershipController.subscribe);
router.get('/:id', authenticate, membershipController.getMembership);
router.post('/:id/cancel', authenticate, membershipController.cancelMembership);
router.post('/:id/pause', authenticate, authorize('owner'), membershipController.pauseMembership);

export default router;
