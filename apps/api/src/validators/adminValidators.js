import { body, param } from 'express-validator';
export { validate } from './authValidators.js';

export const businessHoursRules = [
  param('dayOfWeek')
    .isInt({ min: 0, max: 6 }).withMessage('Day of week must be 0–6'),
  body('openTime')
    .matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Open time must be in HH:MM format'),
  body('closeTime')
    .matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Close time must be in HH:MM format'),
  body('isClosed')
    .isBoolean().withMessage('isClosed must be a boolean'),
];

export const massageBedCreateRules = [
  body('name')
    .trim().notEmpty().withMessage('Bed name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),
];

export const massageBedUpdateRules = [
  body('name')
    .trim().notEmpty().withMessage('Bed name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),
  body('isActive')
    .isBoolean().withMessage('isActive must be a boolean'),
];

export const serviceCreateRules = [
  body('name')
    .trim().notEmpty().withMessage('Service name is required')
    .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer'),
  body('description')
    .optional({ values: 'falsy' }).trim(),
  body('durationMinutes')
    .isInt({ min: 1 }).withMessage('Duration must be a positive integer (minutes)'),
  body('priceCents')
    .isInt({ min: 0 }).withMessage('Price must be a non-negative integer (cents)'),
];

export const serviceUpdateRules = [
  ...serviceCreateRules,
  body('isActive')
    .isBoolean().withMessage('isActive must be a boolean'),
];

export const therapistCreateRules = [
  body('email')
    .isEmail().normalizeEmail().withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName')
    .trim().notEmpty().withMessage('First name is required'),
  body('lastName')
    .trim().notEmpty().withMessage('Last name is required'),
  body('phone')
    .optional({ values: 'falsy' })
    .isMobilePhone().withMessage('Must be a valid phone number'),
  body('bio')
    .optional({ values: 'falsy' }).trim(),
  body('specialties')
    .optional().isArray().withMessage('Specialties must be an array'),
  body('isAcceptingClients')
    .optional().isBoolean().withMessage('isAcceptingClients must be a boolean'),
];

export const therapistUpdateRules = [
  body('bio')
    .optional({ values: 'falsy' }).trim(),
  body('specialties')
    .optional().isArray().withMessage('Specialties must be an array'),
  body('isAcceptingClients')
    .isBoolean().withMessage('isAcceptingClients is required and must be a boolean'),
];
