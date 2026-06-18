/**
 * E2E tests for the address requirement in travel mode.
 *
 * Verifies that:
 *   - A logged-in client with no address on file sees the address step when travel mode is on.
 *   - Completing the address step saves the address to their profile.
 *   - A logged-in client who already has an address on file skips the address step.
 *
 * Uses December 2030 dates — dedicated month to avoid slot conflicts with other suites.
 */
import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, getAuthState, loginInBrowser,
  setAvailability, deleteAvailability,
  mockValidateAddress, mockStripeDisabled,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const { owner, sarah, client } = getAuthState();
const OWNER_TOKEN  = owner.token;
const CLIENT_TOKEN = client.token;
const SARAH_ID     = sarah.userId;
const SARAH_TOKEN  = sarah.token;

const ADDR_DATE  = '2030-12-02'; // Monday in December 2030

const TEST_ADDR = {
  line1: '10 Elm Street',
  city:  'Newton',
  state: 'MA',
  zip:   '02458',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enableTravelMode(request) {
  await request.put('/api/v1/admin/business/travel-settings', {
    data: { travelModeEnabled: true },
    headers: { Authorization: `Bearer ${OWNER_TOKEN}` },
  });
}

async function disableTravelMode(request) {
  await request.put('/api/v1/admin/business/travel-settings', {
    data: { travelModeEnabled: false },
    headers: { Authorization: `Bearer ${OWNER_TOKEN}` },
  });
}

async function clearClientAddress(request) {
  await request.put('/api/v1/users/me', {
    data: { addressLine1: '', addressLine2: '', city: '', state: '', zip: '' },
    headers: { Authorization: `Bearer ${CLIENT_TOKEN}` },
  });
}

/** Navigate to booking page for ADDR_DATE, click the first available slot. */
async function openBookingModal(page) {
  await page.goto('/booking?year=2030&month=12');
  // Wait for auth context to complete before interacting — the sign-out button
  // appears only after the refresh-token exchange has resolved and setUser fired.
  await page.waitForSelector('.header__signout', { timeout: 10000 });
  await page.waitForSelector('.avail-calendar');
  await page.click(`button[aria-label*="${ADDR_DATE}"][aria-label*="available"]`);
  await page.locator('button.slot-btn').first().click();
  await page.waitForSelector('[role="dialog"][aria-labelledby="booking-modal-title"]');
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  await setAvailability(request, SARAH_ID, SARAH_TOKEN, [
    { date: ADDR_DATE, startTime: '09:00', endTime: '17:00' },
  ]);
  await enableTravelMode(request);
  await clearClientAddress(request);
});

test.afterAll(async ({ request }) => {
  await deleteAvailability(request, SARAH_ID, SARAH_TOKEN, [ADDR_DATE]);
  await disableTravelMode(request);
  await clearClientAddress(request);
});

test.beforeEach(async ({ page }) => {
  await mockStripeDisabled(page);
  await mockValidateAddress(page);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test('client with no address on file sees address step in travel mode', async ({ page, request }) => {
  const { accessToken } = await loginInBrowser(page, ACCOUNTS.client);
  await openBookingModal(page);

  // Address step is shown (not the contact step for guests or the health step)
  await expect(page.locator('#bm-addr1')).toBeVisible();
  // Name and email fields belong to the guest contact step — should NOT appear
  expect(await page.locator('#bm-name').count()).toBe(0);
  // Health step fields should not yet be visible
  expect(await page.locator('#bm-medications').count()).toBe(0);

  // Fill address and submit
  await page.fill('#bm-addr1', TEST_ADDR.line1);
  await page.fill('#bm-city',  TEST_ADDR.city);
  await page.fill('#bm-state', TEST_ADDR.state);
  await page.fill('#bm-zip',   TEST_ADDR.zip);
  await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

  // Address step dismissed — modal advanced to the next step (health or payment,
  // depending on what the client already has on file).
  await expect(page.locator('#bm-addr1')).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator('#bm-service')).toBeVisible();

  // Address should be saved to profile
  const res  = await request.get('/api/v1/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  expect(body.data.user.address_line1).toBe(TEST_ADDR.line1);
  expect(body.data.user.city).toBe(TEST_ADDR.city);
});

test('client with address already on file skips address step', async ({ page }) => {
  // Previous test saved the address; fresh login will load the updated user from /auth/refresh
  await loginInBrowser(page, ACCOUNTS.client);
  await openBookingModal(page);

  // Address step should be absent — lands directly on the next step
  await expect(page.locator('#bm-addr1')).not.toBeVisible({ timeout: 5000 });
  expect(await page.locator('#bm-addr1').count()).toBe(0);
});
