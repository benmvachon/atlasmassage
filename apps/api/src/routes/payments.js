import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import {
  addPaymentMethodRules,
  createPaymentIntentRules,
  validate,
} from '../validators/paymentValidators.js';

const router = Router();

router.post('/setup-intent', authenticate, paymentController.createSetupIntent);

router.get('/methods', authenticate, paymentController.listPaymentMethods);
router.post('/methods', authenticate, addPaymentMethodRules, validate, paymentController.addPaymentMethod);
router.delete('/methods/:id', authenticate, paymentController.removePaymentMethod);
router.put('/methods/:id/default', authenticate, paymentController.setDefaultPaymentMethod);

router.post('/intents', authenticate, createPaymentIntentRules, validate, paymentController.createPaymentIntent);

// Stripe sends raw JSON bodies — raw middleware applied in app.js before express.json()
router.post('/webhook', paymentController.handleWebhook);

export default router;
