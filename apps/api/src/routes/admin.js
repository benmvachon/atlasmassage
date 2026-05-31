import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('owner'));

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.listUsers);
router.get('/appointments', adminController.listAppointments);
router.get('/revenue', adminController.getRevenue);
router.get('/therapists', adminController.listTherapists);
router.put('/settings', adminController.updateSettings);
router.get('/audit-logs', adminController.getAuditLogs);

export default router;
