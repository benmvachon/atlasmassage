/**
 * Test helpers for real-API E2E tests.
 *
 * All API calls use Playwright's `request` fixture (goes through the Vite
 * proxy at localhost:5173 → localhost:3001). Tests talk to the real dev
 * stack — no page.route() mocking.
 *
 * Seeded accounts (from apps/api/src/database/seed.js):
 *   owner@atlasmassage.com   / atlas-owner-2024      (roles: owner + therapist)
 *   sarah@atlasmassage.com   / atlas-therapist-2024  (therapist)
 *   marcus@atlasmassage.com  / atlas-therapist-2024  (therapist)
 *   client1@example.com      / atlas-client-2024     (client)
 */

// ── Debug secret ─────────────────────────────────────────────────────────────

export function debugHeaders() {
  return { 'x-debug-secret': process.env.DEBUG_SECRET ?? 'dev-debug-secret' };
}

// ── Seeded credentials ────────────────────────────────────────────────────────

export const ACCOUNTS = {
  owner:    { email: 'owner@atlasmassage.com',  password: 'atlas-owner-2024' },
  sarah:    { email: 'sarah@atlasmassage.com',  password: 'atlas-therapist-2024' },
  marcus:   { email: 'marcus@atlasmassage.com', password: 'atlas-therapist-2024' },
  client:   { email: 'client1@example.com',     password: 'atlas-client-2024' },
};

// ── Auth state (written by globalSetup.js, read once per worker) ──────────────

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _authState = null;
export function getAuthState() {
  if (_authState) return _authState;
  _authState = JSON.parse(readFileSync(resolve(__dirname, '.auth-state.json'), 'utf8'));
  return _authState;
}

// ── Far-future test dates (Sep 2030 — Sep 1 2030 is Sunday) ──────────────────
//
// We use dates far in the future so that:
//  a) They are always > 24 hours away (booking window)
//  b) They never collide with the rolling 35-day seed data
//
// Business hours: Mon–Fri 09:00–19:00, Sat 10:00–17:00, Sun closed.
//
// Computed offsets from 2030-09-01 (Sunday):
// Each test SUITE uses its own dedicated date range to avoid parallel-worker conflicts.
export const DATES = {
  // booking-constraints.spec.js uses Sep 2030 week 1
  mon1: '2030-09-02',  // Monday   — buffer time tests
  tue1: '2030-09-03',  // Tuesday  — daily capacity tests
  wed1: '2030-09-04',  // Wednesday — availability update tests
  thu1: '2030-09-05',  // Thursday  — weekly capacity tests
  fri1: '2030-09-06',  // Friday    — weekly capacity tests (same week as thu1)
  sat1: '2030-09-07',  // Saturday
  sun1: '2030-09-01',  // Sunday (closed)
  // booking-workflows.spec.js uses Sep 2030 week 2
  mon2: '2030-09-09',  // Monday — workflow tests
  tue2: '2030-09-10',
  // therapist-schedule.spec.js uses Oct 2030 (different month entirely)
  schedMon: '2030-10-07', // Monday in Oct 2030
  // bed-assignment.spec.js uses Sep 2030 week 4
  bedMon: '2030-09-23',   // Monday — therapist/owner table visibility + bed capacity
};

// ── Authentication ────────────────────────────────────────────────────────────

/**
 * Log in via the API and return { token, userId } for use in request fixtures.
 * Uses Playwright's standalone `request` (goes through the Vite proxy).
 */
export async function loginForFixtures(request, account) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: account.email, password: account.password },
  });
  const body = await res.json();
  return { token: body.data.accessToken, userId: body.data.user.id };
}

/**
 * Log in via the page's browser context so the HttpOnly refresh-token
 * cookie is set. Returns the access token and user.
 * After this, navigating to any protected page will restore the session.
 */
export async function loginInBrowser(page, account) {
  const res = await page.request.post('/api/v1/auth/login', {
    data: { email: account.email, password: account.password },
  });
  const body = await res.json();
  return body.data; // { user, accessToken }
}

// ── Availability ──────────────────────────────────────────────────────────────

export async function setAvailability(request, therapistId, token, entries) {
  const res = await request.put(`/api/v1/availability/therapists/${therapistId}`, {
    data: { entries },
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function deleteAvailability(request, therapistId, token, dates) {
  return request.delete(`/api/v1/availability/therapists/${therapistId}/dates`, {
    data: { dates },
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setBookingLimits(request, therapistId, token, daily, weekly) {
  return request.patch(`/api/v1/availability/therapists/${therapistId}/limits`, {
    data: { dailyBookingLimit: daily, weeklyBookingLimit: weekly },
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Appointments ──────────────────────────────────────────────────────────────

/**
 * Fetch the first active service ID from the booking calendar.
 * Cached within the test run.
 */
let _cachedServiceId = null;
export async function getServiceId(request) {
  if (_cachedServiceId) return _cachedServiceId;
  const res = await request.get('/api/v1/availability/booking/calendar');
  const body = await res.json();
  _cachedServiceId = body.data.services[0]?.id ?? null;
  return _cachedServiceId;
}

/**
 * Create a guest appointment via the public booking API.
 * Returns { appointment } (no payment intent because Stripe is not invoked
 * for fixture setup — only the DB record matters for constraint verification).
 */
export async function createGuestAppointment(request, { therapistId, serviceId, scheduledAt }) {
  const res = await request.post('/api/v1/appointments', {
    data: {
      therapistId,
      serviceId,
      scheduledAt,
      guestName: 'E2E Test',
      guestEmail: 'e2e@test.invalid',
      waiverSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });
  const body = await res.json();
  return body.data?.appointment ?? null;
}

/**
 * Cancel an appointment as owner (works for any appointment).
 */
export async function cancelAppointment(request, appointmentId, ownerToken) {
  return request.post(`/api/v1/appointments/${appointmentId}/cancel`, {
    data: {},
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
}

// ── Stripe ────────────────────────────────────────────────────────────────────

/**
 * Abort the Stripe CDN so useStripe() returns null and the payment block in
 * handleContinue is skipped. Call BEFORE page.goto().
 *
 * Needed because VITE_STRIPE_PUBLISHABLE_KEY is set in apps/web/.env.
 */
export async function mockStripeDisabled(page) {
  await page.route('https://js.stripe.com/**', route => route.abort());
}

// ── Drawing ───────────────────────────────────────────────────────────────────

/** Draw a squiggle on the waiver signature canvas. */
export async function drawSignature(page) {
  const canvas = page.locator('.waiver-sig__canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 40);
  await page.mouse.move(box.x + 140, box.y + 20);
  await page.mouse.up();
}
