import { body, validationResult } from 'express-validator';
import { AppError } from '../middleware/errorHandler.js';

export function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().reduce((acc, err) => {
      if (!acc[err.path]) acc[err.path] = [];
      acc[err.path].push(err.msg);
      return acc;
    }, {});
    return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', details));
  }
  next();
}

export const registerRules = [
  body('email')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName')
    .trim().notEmpty().withMessage('First name is required'),
  body('lastName')
    .trim().notEmpty().withMessage('Last name is required'),
  body('phone')
    .optional({ values: 'falsy' })
    .isMobilePhone().withMessage('Must be a valid phone number'),
];

export const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Must be a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordRules = [
  body('email').isEmail().normalizeEmail().withMessage('Must be a valid email address'),
];

export const resetPasswordRules = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];
