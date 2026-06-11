/**
 * E2E tests for the guest appointment management page (/booking/manage).
 *
 * Tests the full flow a guest follows after receiving a confirmation email:
 *   1. Page loads and shows appointment details
 *   2. Guest cancels the appointment via the two-step confirm UI
 *
 * Uses Sep 2030 week 3 (Mon Sep 16) — dedicated to this spec to avoid conflicts.
 * Availability is set up and torn down within the suite.
 */
import { test, expect } from '@playwright/test';
import { getAuthState, setAvailability, deleteAvailability, getServiceId } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const { sarah, owner } = getAuthState();
const SARAH_ID    = sarah.userId;
const SARAH_TOKEN = sarah.token;
const OWNER_TOKEN = owner.token;

const MANAGE_DATE      = '2030-09-16'; // Monday week 3 — dedicated to this spec
const MANAGE_SLOT      = '10:00';
const MANAGE_SCHEDULED = `${MANAGE_DATE}T${MANAGE_SLOT}:00.000Z`;

let createdApptId    = null;
let createdCancelToken = null;

test.beforeAll(async ({ request }) => {
  await setAvailability(request, SARAH_ID, SARAH_TOKEN, [
    { date: MANAGE_DATE, startTime: '09:00', endTime: '17:00' },
  ]);

  const serviceId = await getServiceId(request);
  const res = await request.post('/api/v1/appointments', {
    data: {
      therapistId:    SARAH_ID,
      serviceId,
      scheduledAt:    MANAGE_SCHEDULED,
      guestName:      'E2E Manage Guest',
      guestEmail:     'e2e-manage@test.invalid',
      waiverSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });
  const body = await res.json();
  createdApptId      = body.data?.appointment?.id ?? null;
  createdCancelToken = body.data?.appointment?.cancel_token ?? null;
});

test.afterAll(async ({ request }) => {
  if (createdApptId) {
    await request.post(`/api/v1/appointments/${createdApptId}/cancel`, {
      data: {},
      headers: { Authorization: `Bearer ${OWNER_TOKEN}` },
    }).catch(() => {});
  }
  await deleteAvailability(request, SARAH_ID, SARAH_TOKEN, [MANAGE_DATE]).catch(() => {});
});

test('guest manage page shows appointment details', async ({ page }) => {
  expect(createdApptId).toBeTruthy();
  expect(createdCancelToken).toBeTruthy();

  await page.goto(`/booking/manage?id=${createdApptId}&token=${createdCancelToken}`);

  await expect(page.locator('.guest-manage-card')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.guest-manage-card')).toContainText('Massage');
  await expect(page.locator('.guest-manage-card')).toContainText('Sarah');
  await expect(page.locator('.guest-manage-card')).toContainText('September 16, 2030');
  await expect(page.locator('button:has-text("Cancel appointment")')).toBeVisible();
});

test('guest manage page shows error for invalid token', async ({ page }) => {
  await page.goto(`/booking/manage?id=${createdApptId}&token=invalid-token`);
  await expect(page.locator('.feedback-card__error')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.feedback-card__error')).toContainText('invalid or has expired');
});

test('guest can cancel their appointment via the manage page', async ({ page }) => {
  expect(createdApptId).toBeTruthy();

  await page.goto(`/booking/manage?id=${createdApptId}&token=${createdCancelToken}`);
  await expect(page.locator('button:has-text("Cancel appointment")')).toBeVisible({ timeout: 10000 });

  // Step 1: click Cancel appointment
  await page.locator('button:has-text("Cancel appointment")').click();

  // Step 2: confirm dialog appears
  await expect(page.locator('button:has-text("Yes, cancel it")')).toBeVisible();
  await expect(page.locator('button:has-text("Keep appointment")')).toBeVisible();

  // Step 3: confirm cancellation
  await page.locator('button:has-text("Yes, cancel it")').click();

  // Should show success state
  await expect(page.locator('.feedback-card__thanks')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.feedback-card__thanks')).toContainText('cancelled');

  createdApptId = null; // already cancelled; afterAll skip
});
