import { Router } from 'express';
import * as availabilityController from '../controllers/availabilityController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  setAvailabilityRules,
  deleteAvailabilityRules,
  updateLimitsRules,
  validate,
} from '../validators/availabilityValidators.js';

const router = Router();

// ── Public booking calendar ───────────────────────────────────────────────────

router.get('/booking/calendar', availabilityController.getBookingCalendar);
router.get('/booking/slots', availabilityController.getBookingSlots);

// ── Public therapist list / legacy slot stub ──────────────────────────────────

router.get('/therapists', availabilityController.listAvailableTherapists);
router.get('/slots', availabilityController.getAvailableSlots);

// ── Therapist schedule management ────────────────────────────────────────────

router.get('/therapists/:therapistId', availabilityController.getTherapistAvailability);

router.put(
  '/therapists/:therapistId',
  authenticate,
  authorize('therapist', 'owner'),
  setAvailabilityRules,
  validate,
  availabilityController.setTherapistAvailability
);

router.delete(
  '/therapists/:therapistId/dates',
  authenticate,
  authorize('therapist', 'owner'),
  deleteAvailabilityRules,
  validate,
  availabilityController.deleteTherapistAvailability
);

router.patch(
  '/therapists/:therapistId/limits',
  authenticate,
  authorize('therapist', 'owner'),
  updateLimitsRules,
  validate,
  availabilityController.updateTherapistLimits
);

export default router;
