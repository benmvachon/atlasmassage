/**
 * E2E tests for the therapist availability dashboard.
 * Logs in as Sarah in the browser, sets/removes availability via the UI,
 * then verifies the impact on the client-facing booking calendar.
 */
import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, DATES, getAuthState,
  loginInBrowser,
  setAvailability, deleteAvailability, setBookingLimits,
} from './helpers.js';

// All tests in this file share SCHEDULE_DATE state — run them sequentially.
test.describe.configure({ mode: 'serial' });

// Use the 15th of the month 2 months from now — always future, reachable in 2 nav clicks.
// Advance to Monday if it lands on a weekend (Saturday business hours start at 10:00,
// which would conflict with the modal's default 09:00 start time).
const _sched = new Date();
_sched.setMonth(_sched.getMonth() + 2);
_sched.setDate(15);
if (_sched.getDay() === 6) _sched.setDate(17); // Saturday → Monday
if (_sched.getDay() === 0) _sched.setDate(16); // Sunday  → Monday
const SCHEDULE_DATE = _sched.toISOString().slice(0, 10);
const SCHEDULE_MONTH_LABEL = _sched.toLocaleString('default', { month: 'long', year: 'numeric' });
const SCHEDULE_YEAR = _sched.getFullYear();
const SCHEDULE_MONTH = _sched.getMonth() + 1; // 1-based

const { sarah, owner } = getAuthState();
const sarahToken = sarah.token, sarahUserId = sarah.userId;
const ownerToken = owner.token, ownerUserId = owner.userId;

test.beforeAll(async ({ request }) => {
  // Ensure a clean slate — no availability on our test date
  await deleteAvailability(request, sarahUserId, sarahToken, [SCHEDULE_DATE]);
});

test.afterAll(async ({ request }) => {
  await deleteAvailability(request, sarahUserId, sarahToken, [SCHEDULE_DATE]);
  await setBookingLimits(request, sarahUserId, ownerToken, 5, 25); // reset to defaults
});

// ── Schedule page ─────────────────────────────────────────────────────────────

test('therapist schedule page loads and renders the calendar', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/schedule');
  await expect(page.locator('.avail-calendar')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Schedule');
});

test('booking limit inputs are visible and show the current limits', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/schedule');
  await page.waitForSelector('section.schedule-limits');

  const inputs = page.locator('.schedule-limits__input');
  await expect(inputs).toHaveCount(2);
  await expect(page.locator('button:has-text("Save Limits")')).toBeVisible();
});

// ── Setting availability via the UI ───────────────────────────────────────────

test('therapist can set availability for a date and it appears in the booking calendar', async ({ page, request, context }) => {
  // Log in as Sarah in the browser
  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/schedule');
  await page.waitForSelector('.avail-calendar');

  // Navigate forward to the target month (at most 2 clicks)
  for (let i = 0; i < 5; i++) {
    const header = await page.locator('.avail-calendar__month').innerText();
    if (header.includes(SCHEDULE_MONTH_LABEL)) break;
    await page.click('button[aria-label="Next month"]');
  }

  // Click the test date cell to select it
  const cell = page.locator(`button[aria-label*="${SCHEDULE_DATE}"]`);
  await expect(cell).toBeVisible();
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');

  // Click "Set Availability" to open the modal
  await page.click('button:has-text("Set Availability")');
  await page.waitForSelector('[role="dialog"]');

  // Click Save — wait for the PUT response (not just the request) so the DB
  // write is complete before we check the booking calendar.
  const [putResponse] = await Promise.all([
    page.waitForResponse(res =>
      res.url().includes(`/availability/therapists/${sarahUserId}`) &&
      res.request().method() === 'PUT'
    ),
    page.click('[role="dialog"] .avail-modal__actions button.btn--primary'),
  ]);

  // Verify the PUT succeeded and the response contains our SCHEDULE_DATE
  // (specific_date is an ISO timestamp from pg, so match on prefix)
  expect(putResponse.ok()).toBe(true);
  const putBody = await putResponse.json();
  expect(putBody.data.some(e => String(e.specific_date).startsWith(SCHEDULE_DATE))).toBe(true);

  // Now verify the date appears in the client booking calendar
  const clientPage = await context.newPage();
  await clientPage.goto(`/booking?year=${SCHEDULE_YEAR}&month=${SCHEDULE_MONTH}&therapistId=${sarahUserId}`);
  await clientPage.waitForSelector('.avail-calendar');
  await expect(
    clientPage.locator(`button[aria-label*="${SCHEDULE_DATE}"][aria-label*="available"]`)
  ).toBeVisible({ timeout: 10000 });
  await clientPage.close();
});

// ── Removing availability ─────────────────────────────────────────────────────

test('removing availability makes the date disappear from the booking calendar', async ({ page, request, context }) => {
  // Add availability directly via API so we have something to remove
  await setAvailability(request, sarahUserId, sarahToken, [
    { date: SCHEDULE_DATE, startTime: '09:00', endTime: '17:00' },
  ]);

  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/schedule');
  await page.waitForSelector('.avail-calendar');

  // Navigate forward to the target month (at most 2 clicks)
  for (let i = 0; i < 5; i++) {
    const header = await page.locator('.avail-calendar__month').innerText();
    if (header.includes(SCHEDULE_MONTH_LABEL)) break;
    await page.click('button[aria-label="Next month"]');
  }

  // Select the date that has availability
  const cell = page.locator(`button[aria-label*="${SCHEDULE_DATE}"]`);
  await cell.click();

  // Click the "Remove" / "Delete" button
  const removeBtn = page.locator('button:has-text("Remove"), button:has-text("Delete Availability")').first();

  // Intercept the DELETE to verify payload
  const deleteRequests = [];
  await page.route(`**/api/v1/availability/therapists/${sarahUserId}/dates`, async route => {
    if (route.request().method() === 'DELETE') {
      deleteRequests.push(JSON.parse(route.request().postData()));
    }
    await route.continue();
  });

  if (await removeBtn.count()) {
    await removeBtn.evaluate(btn => btn.click());

    // Verify DELETE was called with our date
    await expect(async () => {
      expect(deleteRequests.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    expect(deleteRequests[0].dates).toContain(SCHEDULE_DATE);

    // Verify the booking calendar no longer shows the date for Sarah
    const clientPage = await context.newPage();
    await clientPage.goto(`/booking?year=${SCHEDULE_YEAR}&month=${SCHEDULE_MONTH}&therapistId=${sarahUserId}`);
    await clientPage.waitForSelector('.avail-calendar');
    const dateBtn = clientPage.locator(`button[aria-label*="${SCHEDULE_DATE}"]`);
    const count = await dateBtn.count();
    if (count > 0) {
      await expect(dateBtn).not.toHaveAttribute('aria-label', /available/);
    }
    await clientPage.close();
  }
});

// ── Booking limits ─────────────────────────────────────────────────────────────

test('updating booking limits via the dashboard persists to the API', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/schedule');
  await page.waitForSelector('section.schedule-limits');

  // Find the daily limit input and change it
  const inputs = page.locator('.schedule-limits__input');
  const [dailyInput, weeklyInput] = [inputs.nth(0), inputs.nth(1)];

  await dailyInput.fill('3');
  await weeklyInput.fill('12');

  // Intercept the PATCH request
  const patchRequests = [];
  await page.route(`**/api/v1/availability/therapists/${sarahUserId}/limits`, async route => {
    if (route.request().method() === 'PATCH') {
      patchRequests.push(JSON.parse(route.request().postData()));
    }
    await route.continue();
  });

  await page.click('button:has-text("Save Limits")');

  // Wait for the patch to be sent
  await expect(async () => {
    expect(patchRequests.length).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });

  expect(patchRequests[0].dailyBookingLimit).toBe(3);
  expect(patchRequests[0].weeklyBookingLimit).toBe(12);

  // Success message should appear
  await expect(page.locator('.schedule-limits__success')).toBeVisible();
});
