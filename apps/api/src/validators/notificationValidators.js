import { body } from 'express-validator';
export { validate } from './authValidators.js';

export const updatePreferencesRules = [
  body('emailAppointmentRemind').isBoolean().withMessage('Must be a boolean'),
  body('emailBookingConfirm').isBoolean().withMessage('Must be a boolean'),
  body('smsAppointmentRemind').isBoolean().withMessage('Must be a boolean'),
  body('smsBookingConfirm').isBoolean().withMessage('Must be a boolean'),
];
