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
  body('guestAddressLine1')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 200 }).withMessage('guestAddressLine1 must be 200 characters or fewer'),
  body('guestAddressLine2')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 200 }).withMessage('guestAddressLine2 must be 200 characters or fewer'),
  body('guestCity')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 100 }).withMessage('guestCity must be 100 characters or fewer'),
  body('guestState')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 100 }).withMessage('guestState must be 100 characters or fewer'),
  body('guestZip')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 20 }).withMessage('guestZip must be 20 characters or fewer'),
  body('notes')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 1000 }).withMessage('notes must be 1000 characters or fewer'),
  body('waiverSignature')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 150000 }).withMessage('waiverSignature is too large'),
  body('healthCurrentMedications')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 2000 }).withMessage('healthCurrentMedications must be 2000 characters or fewer'),
  body('healthRecentSurgeries')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 2000 }).withMessage('healthRecentSurgeries must be 2000 characters or fewer'),
  body('healthPregnancyStatus')
    .optional({ values: 'falsy' })
    .isIn(['not_pregnant', 'pregnant', 'recently_pregnant', 'prefer_not_to_say'])
    .withMessage('healthPregnancyStatus must be a valid option'),
  body('healthInjuries')
    .optional({ values: 'falsy' })
    .isString().isLength({ max: 2000 }).withMessage('healthInjuries must be 2000 characters or fewer'),
  body('healthDateOfBirth')
    .optional({ values: 'falsy' })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('healthDateOfBirth must be a valid date (YYYY-MM-DD)'),
];

export const soapNotesRules = [
  body('subjective').notEmpty().withMessage('Subjective notes are required').isString().isLength({ max: 5000 }),
  body('objective').notEmpty().withMessage('Objective notes are required').isString().isLength({ max: 5000 }),
  body('assessment').notEmpty().withMessage('Assessment notes are required').isString().isLength({ max: 5000 }),
  body('plan').notEmpty().withMessage('Plan notes are required').isString().isLength({ max: 5000 }),
];

export const feedbackRules = [
  body('feedbackToken').isUUID().withMessage('feedbackToken must be a valid UUID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be between 1 and 5'),
  body('comments').optional({ values: 'falsy' }).isString().isLength({ max: 2000 }),
];

export const rescheduleAppointmentRules = [
  body('scheduledAt').isISO8601().withMessage('scheduledAt must be an ISO 8601 datetime'),
  body('therapistId').optional().isUUID().withMessage('therapistId must be a valid UUID'),
  body('cancelToken').optional().isUUID().withMessage('cancelToken must be a valid UUID'),
];
