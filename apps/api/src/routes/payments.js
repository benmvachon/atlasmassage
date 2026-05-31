import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/methods', authenticate, paymentController.listPaymentMethods);
router.post('/methods', authenticate, paymentController.addPaymentMethod);
router.delete('/methods/:id', authenticate, paymentController.removePaymentMethod);
router.put('/methods/:id/default', authenticate, paymentController.setDefaultPaymentMethod);
router.post('/intents', authenticate, paymentController.createPaymentIntent);
router.post('/webhook', paymentController.handleWebhook);

export default router;
