import { Router } from 'express';
import * as availabilityController from '../controllers/availabilityController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/therapists', availabilityController.listAvailableTherapists);
router.get('/slots', availabilityController.getAvailableSlots);
router.get('/therapists/:therapistId', availabilityController.getTherapistAvailability);
router.put('/therapists/:therapistId', authenticate, authorize('therapist', 'owner'), availabilityController.setTherapistAvailability);

export default router;
