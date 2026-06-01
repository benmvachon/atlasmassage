import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';
import { createAppointmentRules, validate } from '../validators/appointmentValidators.js';

const router = Router();

router.get('/', authenticate, appointmentController.listAppointments);
// Guest checkout: authentication is optional — unauthenticated callers provide guest fields in the body
router.post('/', optionalAuthenticate, createAppointmentRules, validate, appointmentController.createAppointment);
router.get('/:id', authenticate, appointmentController.getAppointment);
router.put('/:id', authenticate, appointmentController.updateAppointment);
router.post('/:id/cancel', authenticate, appointmentController.cancelAppointment);
// Clients confirm their own booking after successful payment; staff can also confirm
router.post('/:id/confirm', authenticate, appointmentController.confirmAppointment);
router.post('/:id/complete', authenticate, authorize('therapist', 'owner'), appointmentController.completeAppointment);
router.post('/:id/transfer-request', authenticate, authorize('therapist'), appointmentController.requestTransfer);

export default router;
