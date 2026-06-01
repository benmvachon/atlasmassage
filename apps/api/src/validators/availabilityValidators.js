import { body } from 'express-validator';
export { validate } from './authValidators.js';

export const setAvailabilityRules = [
  body('entries')
    .isArray({ min: 1 }).withMessage('entries must be a non-empty array'),
  body('entries.*.date')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Each entry must have a valid date (YYYY-MM-DD)'),
  body('entries.*.startTime')
    .matches(/^\d{2}:\d{2}$/).withMessage('startTime must be in HH:MM format'),
  body('entries.*.endTime')
    .matches(/^\d{2}:\d{2}$/).withMessage('endTime must be in HH:MM format'),
];

export const deleteAvailabilityRules = [
  body('dates')
    .isArray({ min: 1 }).withMessage('dates must be a non-empty array'),
  body('dates.*')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Each date must be in YYYY-MM-DD format'),
];

export const updateLimitsRules = [
  body('dailyBookingLimit')
    .isInt({ min: 1, max: 100 }).withMessage('dailyBookingLimit must be an integer between 1 and 100'),
  body('weeklyBookingLimit')
    .isInt({ min: 1, max: 500 }).withMessage('weeklyBookingLimit must be an integer between 1 and 500'),
];
