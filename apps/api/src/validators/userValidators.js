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
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];
