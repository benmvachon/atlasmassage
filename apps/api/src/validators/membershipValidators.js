import { body } from 'express-validator';
export { validate } from './authValidators.js';

export const createPlanRules = [
  body('name')
    .trim().notEmpty().withMessage('Plan name is required')
    .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer'),
  body('description')
    .optional({ values: 'falsy' }).trim(),
  body('priceMonthlyCents')
    .isInt({ min: 1 }).withMessage('Price must be a positive integer in cents'),
  body('creditsPerMonth')
    .isInt({ min: 1 }).withMessage('Credits per month must be a positive integer'),
];

export const updatePlanRules = [
  body('name')
    .optional().trim().notEmpty().withMessage('Name cannot be blank')
    .isLength({ max: 255 }),
  body('description')
    .optional({ values: 'falsy' }).trim(),
  body('priceMonthlyCents')
    .optional().isInt({ min: 1 }).withMessage('Price must be a positive integer in cents'),
  body('creditsPerMonth')
    .optional().isInt({ min: 1 }).withMessage('Credits per month must be a positive integer'),
  body('isActive')
    .optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const subscribeRules = [
  body('planId')
    .isUUID().withMessage('Plan ID must be a valid UUID'),
  body('stripePaymentMethodId')
    .optional().trim().notEmpty(),
];
