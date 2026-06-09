/**
 * E2E tests for massage table (bed) assignment.
 *
 * Run the full dev stack first:  npm run dev
 * Then run:                       npm test --workspace=apps/e2e
 *
 * Uses 2030-09-22 (Monday week 4 of Sep 2030) — isolated from all other spec files.
 */
import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, DATES, getAuthState,
  loginInBrowser,
  setAvailability, deleteAvailability,
  createGuestAppointment, cancelAppointment, getServiceId,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const { owner, sarah, marcus } = getAuthState();
const testDate = DATES.bedMon; // 2030-09-22

// ── Therapist sees Table column and assigned bed name ─────────────────────────

test.describe('Bed assignment — therapist bookings view', () => {
  let serviceId;
  let appointmentId;

  test.beforeAll(async ({ request }) => {
    serviceId = await getServiceId(request);

    await setAvailability(request, sarah.userId, sarah.token, [
      { date: testDate, startTime: '09:00', endTime: '17:00' },
    ]);

    const appt = await createGuestAppointment(request, {
      therapistId: sarah.userId,
      serviceId,
      scheduledAt: `${testDate}T09:00:00.000Z`,
    });
    if (!appt?.id) throw new Error('beforeAll: guest appointment creation failed — check server logs');
    appointmentId = appt.id;
  });

  test.afterAll(async ({ request }) => {
    if (appointmentId) await cancelAppointment(request, appointmentId, owner.token);
    await deleteAvailability(request, sarah.userId, sarah.token, [testDate]);
  });

  test('Table column header is visible in the therapist bookings table', async ({ page }) => {
    await loginInBrowser(page, ACCOUNTS.sarah);
    await page.goto('/therapist/bookings');
    await page.waitForSelector('.owner-table');

    await expect(page.locator('.owner-table th:has-text("Table")')).toBeVisible();
  });

  test('assigned bed name appears in the appointment row', async ({ page }) => {
    await loginInBrowser(page, ACCOUNTS.sarah);
    await page.goto('/therapist/bookings');
    // Wait for at least one data row so the list is fully populated
    await page.waitForSelector('.owner-table tbody tr');

    // The newly booked appointment must show its assigned bed name.
    // The seed has 3 active beds named "Table 1", "Table 2", "Table 3".
    await expect(page.locator('.owner-table')).toContainText(/Table [1-3]/);
  });
});

// ── Owner sees table name in appointment detail modal ─────────────────────────

test.describe('Bed assignment — owner appointment detail modal', () => {
  test('Table row is shown with a bed name in the appointment detail', async ({ page }) => {
    await loginInBrowser(page, ACCOUNTS.owner);

    // Intercept the admin appointments list and inject a fake appointment with bed_name set.
    // This avoids date-navigation complexity (the owner calendar defaults to the current week).
    await page.route('**/api/v1/admin/appointments**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            appointments: [{
              id: 'e2e-bed-appt',
              status: 'pending',
              scheduled_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
              duration_minutes: 60,
              service_name: 'Deep Tissue',
              price_cents: 9000,
              therapist_id: sarah.userId,
              therapist_first_name: 'Sarah',
              therapist_last_name: 'Johnson',
              client_name: 'E2E Client',
              client_email: 'e2e@test.invalid',
              client_phone: null,
              guest_phone: null,
              consent_signed_at: null,
              notes: null,
              bed_name: 'Table 2',
            }],
            therapists: [{ id: sarah.userId, first_name: 'Sarah', last_name: 'Johnson' }],
          },
        }),
      });
    });

    await page.goto('/owner/appointments');
    await page.waitForSelector('.cal-toolbar');

    // Switch to List view so the appointment is visible regardless of the current week
    await page.click('button:has-text("List")');
    await page.waitForSelector('.cal-list__appt');

    // Open the appointment detail
    await page.click('.cal-list__appt');
    await page.waitForSelector('.cal-detail');

    // Verify the Table row and its value are present
    await expect(page.locator('.cal-detail dt:has-text("Table")')).toBeVisible();
    await expect(page.locator('.cal-detail dd:has-text("Table 2")')).toBeVisible();
  });
});

// ── Bed capacity: all slots blocked when every table is occupied ───────────────

test.describe('Bed capacity enforcement', () => {
  let serviceId;
  const createdApptIds = [];

  test.beforeAll(async ({ request }) => {
    serviceId = await getServiceId(request);

    // Give all three therapists availability on the test date
    await Promise.all([
      setAvailability(request, owner.userId,  owner.token,  [{ date: testDate, startTime: '09:00', endTime: '17:00' }]),
      setAvailability(request, sarah.userId,  sarah.token,  [{ date: testDate, startTime: '09:00', endTime: '17:00' }]),
      setAvailability(request, marcus.userId, marcus.token, [{ date: testDate, startTime: '09:00', endTime: '17:00' }]),
    ]);

    // Create one appointment per therapist at 09:00 — each takes a different bed.
    // With 3 active beds all occupied, no further bookings can start at 09:00.
    for (const therapistId of [owner.userId, sarah.userId, marcus.userId]) {
      const appt = await createGuestAppointment(request, {
        therapistId,
        serviceId,
        scheduledAt: `${testDate}T09:00:00.000Z`,
      });
      if (appt?.id) createdApptIds.push(appt.id);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdApptIds) {
      await cancelAppointment(request, id, owner.token);
    }
    await Promise.all([
      deleteAvailability(request, owner.userId,  owner.token,  [testDate]),
      deleteAvailability(request, sarah.userId,  sarah.token,  [testDate]),
      deleteAvailability(request, marcus.userId, marcus.token, [testDate]),
    ]);
  });

  test('no slots are shown for a time when all massage tables are occupied', async ({ page }) => {
    await page.goto(`/booking?year=2030&month=9`);
    await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);
    await page.waitForSelector('.slot-panel__grid');

    const times = await page.locator('button.slot-btn').evaluateAll(btns =>
      btns.map(b => b.getAttribute('aria-label')?.match(/^(\d+:\d+ [AP]M)/)?.[1]).filter(Boolean)
    );

    // All 3 beds occupied at 09:00 — the 09:00 slot (and buffer window) must be absent.
    // The first available slot after the buffer clears is 10:15 AM.
    const blockedByBeds = ['9:00 AM', '9:15 AM', '9:30 AM', '9:45 AM', '10:00 AM'];
    for (const t of blockedByBeds) {
      expect(times, `expected ${t} to be blocked`).not.toContain(t);
    }
    expect(times).toContain('10:15 AM');
  });
});
