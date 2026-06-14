import { Router } from 'express';
import { purchaseGiftCard, validateGiftCard, listGiftCards } from '../controllers/giftCardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public: initiate purchase (redirects to Stripe Checkout)
router.post('/purchase', purchaseGiftCard);

// Public: validate a code and return its balance (used in booking modal)
router.get('/:code/validate', validateGiftCard);

// Owner only: list all gift cards
router.get('/', authenticate, authorize('owner'), listGiftCards);

export default router;
