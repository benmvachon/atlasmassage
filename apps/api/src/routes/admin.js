import { Router } from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import multer from 'multer';
import * as adminController from '../controllers/adminController.js';
import * as testimonialController from '../controllers/testimonialController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  businessHoursRules,
  massageBedCreateRules,
  massageBedUpdateRules,
  membershipPlanCreateRules,
  membershipPlanUpdateRules,
  serviceCreateRules,
  serviceUpdateRules,
  therapistCreateRules,
  therapistUpdateRules,
  testimonialCreateRules,
  testimonialUpdateRules,
  validate,
} from '../validators/adminValidators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const headshotStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'headshots'),
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadHeadshot = multer({
  storage: headshotStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  },
}).single('headshot');

const router = Router();

router.use(authenticate, authorize('owner'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ── Appointments (calendar) ───────────────────────────────────────────────────
router.get('/appointments', adminController.listAppointments);
router.patch('/appointments/:id/status', adminController.updateAppointmentStatus);
router.post('/appointments/:id/charge-no-show', adminController.chargeNoShow);
router.post('/appointments/:id/record-payment', adminController.recordInPersonPayment);

// ── Revenue ───────────────────────────────────────────────────────────────────
router.get('/revenue', adminController.getRevenue);

// ── Transfer requests ─────────────────────────────────────────────────────────
router.get('/transfer-requests', adminController.listTransferRequests);
router.post('/transfer-requests/:id/approve', adminController.approveTransferRequest);
router.post('/transfer-requests/:id/deny', adminController.denyTransferRequest);

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

// ── Membership plans ──────────────────────────────────────────────────────────
router.get('/membership-plans', adminController.listMembershipPlans);
router.post('/membership-plans', membershipPlanCreateRules, validate, adminController.createMembershipPlan);
router.put('/membership-plans/:id', membershipPlanUpdateRules, validate, adminController.updateMembershipPlan);

// ── Therapist management ──────────────────────────────────────────────────────
router.get('/therapists', adminController.listTherapists);
router.post('/therapists', therapistCreateRules, validate, adminController.createTherapist);
router.get('/therapists/:id', adminController.getTherapist);
router.put('/therapists/:id', therapistUpdateRules, validate, adminController.updateTherapist);
router.post('/therapists/:id/headshot', uploadHeadshot, adminController.uploadTherapistHeadshot);
router.delete('/therapists/:id', adminController.deactivateTherapist);

// ── Testimonials ──────────────────────────────────────────────────────────────
router.get('/testimonials', testimonialController.listAll);
router.post('/testimonials', testimonialCreateRules, validate, testimonialController.createTestimonial);
router.put('/testimonials/:id', testimonialUpdateRules, validate, testimonialController.updateTestimonial);
router.delete('/testimonials/:id', testimonialController.deleteTestimonial);

export default router;
