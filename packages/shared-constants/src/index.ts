export const USER_ROLES = {
  CLIENT: 'client',
  THERAPIST: 'therapist',
  OWNER: 'owner',
} as const;

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
} as const;

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const ROUTES = {
  HOME: '/',
  SERVICES: '/services',
  TESTIMONIALS: '/testimonials',
  TEAM: '/team',
  LOGIN: '/login',
  BOOKING: '/booking',
  SETTINGS: '/settings',
  THERAPIST_SCHEDULE: '/therapist/schedule',
  THERAPIST_SETTINGS: '/therapist/settings',
  OWNER_DASHBOARD: '/owner/dashboard',
} as const;
