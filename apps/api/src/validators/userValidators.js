import { body } from 'express-validator';
export { validate } from './authValidators.js';

export const updateMeRules = [
  body('firstName')
    .optional().trim().notEmpty().withMessage('First name cannot be blank')
    .isLength({ max: 100 }).withMessage('First name must be 100 characters or fewer'),
  body('lastName')
    .optional().trim().notEmpty().withMessage('Last name cannot be blank')
    .isLength({ max: 100 }).withMessage('Last name must be 100 characters or fewer'),
  body('phone')
    .optional({ values: 'falsy' })
    .isMobilePhone().withMessage('Must be a valid phone number'),
  body('addressLine1').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Street address too long'),
  body('addressLine2').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Address line 2 too long'),
  body('city').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('City too long'),
  body('state').optional({ values: 'falsy' }).trim().isLength({ max: 2 }).withMessage('State must be a 2-letter abbreviation'),
  body('zip').optional({ values: 'falsy' }).trim().isLength({ max: 10 }).withMessage('ZIP code too long'),
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];
