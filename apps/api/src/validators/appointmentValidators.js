import { body } from 'express-validator';
export { validate } from './authValidators.js';

export const createAppointmentRules = [
  body('therapistId').optional({ values: 'falsy' }).isUUID().withMessage('therapistId must be a valid UUID'),
  body('serviceId').isUUID().withMessage('serviceId must be a valid UUID'),
  body('scheduledAt').isISO8601().withMessage('scheduledAt must be an ISO 8601 datetime'),
  body('guestName')
    .if(body('guestEmail').exists({ checkFalsy: true }))
    .notEmpty().withMessage('guestName is required for guest bookings'),
  body('guestEmail')
    .optional({ values: 'falsy' })
    .isEmail().normalizeEmail().withMessage('guestEmail must be a valid email'),
  body('guestPhone')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 30 }).withMessage('guestPhone must be 30 characters or fewer'),
  body('notes')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 1000 }).withMessage('notes must be 1000 characters or fewer'),
  body('waiverSignature')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 150000 }).withMessage('waiverSignature is too large'),
];

export const rescheduleAppointmentRules = [
  body('scheduledAt').isISO8601().withMessage('scheduledAt must be an ISO 8601 datetime'),
  body('therapistId').optional().isUUID().withMessage('therapistId must be a valid UUID'),
  body('cancelToken').optional().isUUID().withMessage('cancelToken must be a valid UUID'),
];
