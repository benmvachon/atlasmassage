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

export const bookingRestrictionsRules = [
  body('restrictPregnancy')
    .isBoolean().withMessage('restrictPregnancy must be a boolean'),
  body('restrictMinors')
    .isBoolean().withMessage('restrictMinors must be a boolean'),
];

export const schedulingSettingsRules = [
  body('bufferMinutes')
    .isInt({ min: 0, max: 120 }).withMessage('bufferMinutes must be an integer between 0 and 120'),
];

export const travelSettingsRules = [
  body('travelModeEnabled')
    .isBoolean().withMessage('travelModeEnabled must be a boolean'),
  body('maxDriveMinutes')
    .optional()
    .isInt({ min: 5, max: 120 }).withMessage('maxDriveMinutes must be an integer between 5 and 120'),
];

export const businessContactInfoRules = [
  body('addressLine1')
    .trim().notEmpty().withMessage('Address is required')
    .isLength({ max: 200 }).withMessage('Address must be 200 characters or fewer'),
  body('addressLine2')
    .optional({ values: 'falsy' }).trim()
    .isLength({ max: 200 }).withMessage('Address line 2 must be 200 characters or fewer'),
  body('city')
    .trim().notEmpty().withMessage('City is required')
    .isLength({ max: 100 }).withMessage('City must be 100 characters or fewer'),
  body('state')
    .trim().notEmpty().withMessage('State is required')
    .isLength({ max: 100 }).withMessage('State must be 100 characters or fewer'),
  body('zip')
    .trim().notEmpty().withMessage('ZIP code is required')
    .isLength({ max: 20 }).withMessage('ZIP code must be 20 characters or fewer'),
  body('phone')
    .trim().notEmpty().withMessage('Phone number is required')
    .isMobilePhone().withMessage('Must be a valid phone number'),
  body('email')
    .isEmail().normalizeEmail().withMessage('Must be a valid email address'),
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
  body('displayOrder')
    .optional().isInt({ min: 0 }).withMessage('displayOrder must be a non-negative integer'),
];

export const testimonialCreateRules = [
  body('authorName')
    .trim().notEmpty().withMessage('Author name is required')
    .isLength({ max: 100 }).withMessage('Author name must be 100 characters or fewer'),
  body('body')
    .trim().notEmpty().withMessage('Testimonial text is required'),
  body('rating')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('isPublished')
    .optional().isBoolean().withMessage('isPublished must be a boolean'),
  body('displayOrder')
    .optional().isInt({ min: 0 }).withMessage('displayOrder must be a non-negative integer'),
];

export const membershipPlanCreateRules = [
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

export const membershipPlanUpdateRules = [
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

export const testimonialUpdateRules = [
  body('authorName')
    .trim().notEmpty().withMessage('Author name is required')
    .isLength({ max: 100 }).withMessage('Author name must be 100 characters or fewer'),
  body('body')
    .trim().notEmpty().withMessage('Testimonial text is required'),
  body('rating')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('isPublished')
    .isBoolean().withMessage('isPublished is required and must be a boolean'),
  body('displayOrder')
    .optional().isInt({ min: 0 }).withMessage('displayOrder must be a non-negative integer'),
];

// ── Essays ────────────────────────────────────────────────────────────────────
// slug is optional on both create and update — the controller derives it from
// the title when omitted.

const essayFieldRules = [
  body('title')
    .trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be 200 characters or fewer'),
  body('slug')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 }).withMessage('Slug must be 120 characters or fewer')
    .matches(/^[a-z0-9-]+$/).withMessage('Slug may contain only lowercase letters, numbers, and hyphens'),
  body('subtitle')
    .optional({ values: 'falsy' })
    .trim().isLength({ max: 300 }).withMessage('Subtitle must be 300 characters or fewer'),
  body('author')
    .optional({ values: 'falsy' })
    .trim().isLength({ max: 120 }).withMessage('Author must be 120 characters or fewer'),
  body('summary')
    .optional({ values: 'falsy' }).trim(),
  body('bodyMarkdown')
    .trim().notEmpty().withMessage('Essay body is required'),
  body('heroImagePath')
    .optional({ nullable: true, values: 'falsy' })
    .trim().isLength({ max: 255 }).withMessage('Hero image path must be 255 characters or fewer'),
  body('heroImageAlt')
    .optional({ values: 'falsy' })
    .trim().isLength({ max: 300 }).withMessage('Hero image alt text must be 300 characters or fewer'),
  body('displayOrder')
    .optional().isInt({ min: 0 }).withMessage('displayOrder must be a non-negative integer'),
  // Sent as YYYY-MM-DD by the dashboard; an empty value clears the date.
  body('publishedAt')
    .optional({ nullable: true, values: 'falsy' })
    .isISO8601().withMessage('publishedAt must be a valid date'),
];

export const essayCreateRules = [
  ...essayFieldRules,
  body('isPublished')
    .optional().isBoolean().withMessage('isPublished must be a boolean'),
];

export const essayUpdateRules = [
  ...essayFieldRules,
  body('isPublished')
    .isBoolean().withMessage('isPublished is required and must be a boolean'),
];

export const essayReorderRules = [
  body('orderedIds')
    .isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array'),
  body('orderedIds.*')
    .isUUID().withMessage('orderedIds must contain only essay ids'),
];
