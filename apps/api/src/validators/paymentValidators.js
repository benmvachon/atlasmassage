import { body } from 'express-validator';
export { validate } from './authValidators.js';

export const addPaymentMethodRules = [
  body('stripePaymentMethodId')
    .trim().notEmpty().withMessage('Stripe payment method ID is required'),
];

export const createPaymentIntentRules = [
  body('amountCents')
    .isInt({ min: 1 }).withMessage('Amount must be a positive integer in cents'),
  body('currency')
    .optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code'),
  body('paymentMethodId')
    .optional().isUUID().withMessage('Invalid payment method ID'),
  body('appointmentId')
    .optional().isUUID().withMessage('Invalid appointment ID'),
];
