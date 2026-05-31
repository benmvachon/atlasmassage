import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, appointmentController.listAppointments);
router.post('/', authenticate, authorize('client'), appointmentController.createAppointment);
router.get('/:id', authenticate, appointmentController.getAppointment);
router.put('/:id', authenticate, appointmentController.updateAppointment);
router.post('/:id/cancel', authenticate, appointmentController.cancelAppointment);
router.post('/:id/confirm', authenticate, authorize('therapist', 'owner'), appointmentController.confirmAppointment);
router.post('/:id/complete', authenticate, authorize('therapist', 'owner'), appointmentController.completeAppointment);

export default router;
