import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';
import { createAppointmentRules, rescheduleAppointmentRules, soapNotesRules, feedbackRules, validateAddressRules, validate } from '../validators/appointmentValidators.js';

const router = Router();

router.get('/', authenticate, appointmentController.listAppointments);
// Status checks for authenticated clients (must be before /:id to avoid route collision)
router.get('/consent/status', authenticate, appointmentController.getConsentStatus);
router.get('/health/status', authenticate, appointmentController.getHealthStatus);
// Guest checkout: authentication is optional — unauthenticated callers provide guest fields in the body
router.post('/', optionalAuthenticate, createAppointmentRules, validate, appointmentController.createAppointment);
// Verifies a guest's mailing address before the booking step can proceed
router.post('/validate-address', validateAddressRules, validate, appointmentController.validateGuestAddress);
router.get('/:id', authenticate, appointmentController.getAppointment);
router.put('/:id', authenticate, appointmentController.updateAppointment);
// Cancel and reschedule: open to guests (cancelToken in body) and authenticated clients/owners
router.post('/:id/cancel', optionalAuthenticate, appointmentController.cancelAppointment);
router.post('/:id/reschedule', optionalAuthenticate, rescheduleAppointmentRules, validate, appointmentController.rescheduleAppointment);
// Clients confirm their own booking after successful payment; guests pass cancelToken; staff can also confirm
router.post('/:id/confirm', optionalAuthenticate, appointmentController.confirmAppointment);
router.post('/:id/complete', authenticate, authorize('therapist', 'owner'), appointmentController.completeAppointment);
router.post('/:id/record-payment', authenticate, authorize('therapist', 'owner'), appointmentController.recordPayment);
router.post('/:id/charge-no-show', authenticate, authorize('therapist', 'owner'), appointmentController.chargeNoShow);
router.post('/:id/transfer-request', authenticate, authorize('therapist'), appointmentController.requestTransfer);

// SOAP notes — therapist writes clinical notes after a completed session
router.get('/:id/soap-notes', authenticate, authorize('therapist', 'owner'), appointmentController.getSoapNotes);
router.post('/:id/soap-notes', authenticate, authorize('therapist', 'owner'), soapNotesRules, validate, appointmentController.upsertSoapNotes);

// Client history — full timeline of intake, consent, soap notes, and feedback
router.get('/:id/client-history', authenticate, authorize('therapist', 'owner'), appointmentController.getClientHistory);

// Guest manage — public endpoint, verified by cancel_token
router.get('/:id/guest', appointmentController.getGuestAppointment);

// Client feedback — public endpoints, verified by feedback_token
router.get('/:id/feedback-info', appointmentController.getFeedbackInfo);
router.post('/:id/feedback', feedbackRules, validate, appointmentController.submitFeedback);

export default router;
