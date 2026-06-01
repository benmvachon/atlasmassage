import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  businessHoursRules,
  massageBedCreateRules,
  massageBedUpdateRules,
  serviceCreateRules,
  serviceUpdateRules,
  therapistCreateRules,
  therapistUpdateRules,
  validate,
} from '../validators/adminValidators.js';

const router = Router();

router.use(authenticate, authorize('owner'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ── Appointments (calendar) ───────────────────────────────────────────────────
router.get('/appointments', adminController.listAppointments);
router.patch('/appointments/:id/status', adminController.updateAppointmentStatus);

// ── Revenue ───────────────────────────────────────────────────────────────────
router.get('/revenue', adminController.getRevenue);

// ── Remaining stubs ───────────────────────────────────────────────────────────
router.get('/users', adminController.listUsers);
router.put('/settings', adminController.updateSettings);
router.get('/audit-logs', adminController.getAuditLogs);

// ── Business details ──────────────────────────────────────────────────────────
router.get('/business', adminController.getBusinessDetails);
router.put('/business/hours/:dayOfWeek', businessHoursRules, validate, adminController.updateBusinessHours);

// ── Massage tables ────────────────────────────────────────────────────────────
router.get('/business/beds', adminController.listMassageBeds);
router.post('/business/beds', massageBedCreateRules, validate, adminController.createMassageBed);
router.put('/business/beds/:id', massageBedUpdateRules, validate, adminController.updateMassageBed);
router.delete('/business/beds/:id', adminController.deleteMassageBed);

// ── Services ──────────────────────────────────────────────────────────────────
router.get('/services', adminController.listServices);
router.post('/services', serviceCreateRules, validate, adminController.createService);
router.put('/services/:id', serviceUpdateRules, validate, adminController.updateService);
router.delete('/services/:id', adminController.deactivateService);

// ── Therapist management ──────────────────────────────────────────────────────
router.get('/therapists', adminController.listTherapists);
router.post('/therapists', therapistCreateRules, validate, adminController.createTherapist);
router.get('/therapists/:id', adminController.getTherapist);
router.put('/therapists/:id', therapistUpdateRules, validate, adminController.updateTherapist);
router.delete('/therapists/:id', adminController.deactivateTherapist);

export default router;
