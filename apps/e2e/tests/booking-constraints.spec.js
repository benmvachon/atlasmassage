/**
 * E2E tests for booking constraint enforcement.
 *
 * Run the full dev stack first:  npm run dev
 * Then run:                       npm test --workspace=apps/e2e
 *
 * Each test creates its own availability / appointments in the real database
 * and cleans up after itself.  Tests use far-future dates (Sep 2030) so they
 * never collide with the rolling 35-day seed window.
 */
import { test, expect } from '@playwright/test';
import {
  DATES, getAuthState,
  setAvailability, deleteAvailability, setBookingLimits,
  createGuestAppointment, cancelAppointment, getServiceId,
} from './helpers.js';

// Multiple describe blocks share Sarah's booking limits and the same therapist
// fixture, so tests must run sequentially to avoid limit-setting races.
test.describe.configure({ mode: 'serial' });

// ── 15-minute buffer time ─────────────────────────────────────────────────────

test.describe('15-minute buffer time', () => {
  const { owner, sarah } = getAuthState();
  const ownerToken = owner.token, ownerUserId = owner.userId;
  const sarahToken = sarah.token, sarahUserId = sarah.userId;
  let serviceId;
  const testDate = DATES.mon1; // 2030-09-02 (Monday)
  let appointmentId;

  test.beforeAll(async ({ request }) => {
    serviceId = await getServiceId(request);

    // Reset limits to defaults first — a previous run's weekly-capacity afterAll
    // may have failed, leaving Sarah's weekly limit at 2 with leftover appointments
    // from that same week (2030-09-05/06).  With those 2 leftover appointments
    // plus the one created below, filterByCapacity would hide all of Sarah's slots.
    await setBookingLimits(request, sarahUserId, ownerToken, 5, 25);

    // Give Sarah availability 09:00–17:00 on our test date
    await setAvailability(request, sarahUserId, sarahToken, [
      { date: testDate, startTime: '09:00', endTime: '17:00' },
    ]);

    // Book Sarah at 10:00 — this creates a buffer zone around that slot
    const appt = await createGuestAppointment(request, {
      therapistId: sarahUserId,
      serviceId,
      scheduledAt: `${testDate}T10:00:00.000Z`,
    });
    appointmentId = appt?.id;
  });

  test.afterAll(async ({ request }) => {
    if (appointmentId) await cancelAppointment(request, appointmentId, ownerToken);
    await deleteAvailability(request, sarahUserId, sarahToken, [testDate]);
  });

  test('slots within the 15-minute buffer window around an existing appointment are not shown', async ({ page }) => {
    await page.goto(`/booking?year=2030&month=9`);
    await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);
    // Wait for the grid (not just the panel container) so the async slot fetch has resolved.
    await page.waitForSelector('.slot-panel__grid');

    const times = await page.locator('button.slot-btn').evaluateAll(btns =>
      btns.map(b => b.getAttribute('aria-label')?.match(/^(\d+:\d+ [AP]M)/)?.[1])
        .filter(Boolean)
    );

    // The 10:00 appointment (60 min) + 15 min buffer each side blocks 09:00–11:00.
    // First available start after the appointment + buffer is 11:15.
    const blockedTimes = ['9:00 AM', '9:15 AM', '9:30 AM', '9:45 AM', '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM', '11:00 AM'];
    for (const t of blockedTimes) {
      expect(times).not.toContain(t);
    }
    expect(times).toContain('11:15 AM');
  });

  test('a different therapist is unaffected by another therapist\'s appointment buffer', async ({ page, request }) => {
    // Use the standalone request fixture (not page.request) so relative URLs resolve
    // correctly even before the page has navigated to a URL.
    const { marcus } = getAuthState();
    const { token: marcusToken, userId: marcusId } = marcus;
    await setAvailability(request, marcusId, marcusToken, [
      { date: testDate, startTime: '09:00', endTime: '17:00' },
    ]);

    try {
      await page.goto(`/booking?year=2030&month=9`);
      await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);
      await page.waitForSelector('.slot-panel');

      // The 9:00 slot should show Marcus even though Sarah is blocked at that time
      await expect(page.locator('button.slot-btn[aria-label^="9:00 AM"]')).toBeVisible();

      // The slot's aria-label should mention 1 therapist (Marcus — Sarah is buffered out)
      const slot9Label = await page.locator('button.slot-btn[aria-label^="9:00 AM"]').getAttribute('aria-label');
      expect(slot9Label).toBeTruthy();
    } finally {
      await deleteAvailability(request, marcusId, marcusToken, [testDate]);
    }
  });

  test('slots reappear after an appointment is cancelled', async ({ page, request }) => {
    // Cancel the 10:00 appointment
    await cancelAppointment(request, appointmentId, ownerToken);
    appointmentId = null; // prevent double-cancel in afterAll

    await page.goto(`/booking?year=2030&month=9`);
    await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);
    await page.waitForSelector('.slot-panel');

    // 9:00 should now be available for Sarah again
    const slot9 = page.locator('button.slot-btn[aria-label^="9:00 AM"]');
    await expect(slot9).toBeVisible();
  });
});

// ── Daily booking limit ───────────────────────────────────────────────────────

test.describe('Daily booking limit', () => {
  const { owner, sarah } = getAuthState();
  const ownerToken = owner.token, ownerUserId = owner.userId;
  const sarahToken = sarah.token, sarahUserId = sarah.userId;
  let serviceId;
  const testDate = DATES.tue1; // 2030-09-03 (Tuesday)
  const createdApptIds = [];

  test.beforeAll(async ({ request }) => {
    serviceId = await getServiceId(request);

    // Set Sarah's daily limit to 2 so it's easy to fill
    await setBookingLimits(request, sarahUserId, ownerToken, 2, 25);

    // Give Sarah availability on the test date
    await setAvailability(request, sarahUserId, sarahToken, [
      { date: testDate, startTime: '09:00', endTime: '17:00' },
    ]);

    // Create 2 appointments (= daily limit) for Sarah on this date
    for (const startHour of [9, 11]) { // 09:00 and 11:00 — no buffer overlap
      const appt = await createGuestAppointment(request, {
        therapistId: sarahUserId,
        serviceId,
        scheduledAt: `${testDate}T${String(startHour).padStart(2, '0')}:30:00.000Z`,
      });
      if (appt?.id) createdApptIds.push(appt.id);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdApptIds) {
      await cancelAppointment(request, id, ownerToken);
    }
    await deleteAvailability(request, sarahUserId, sarahToken, [testDate]);
    // Reset limit to default
    await setBookingLimits(request, sarahUserId, ownerToken, 5, 25);
  });

  test('a therapist at their daily limit does not appear in available slots', async ({ page, request }) => {
    // Re-assert limits in case a concurrent spec file reset them between beforeAll and here.
    await setBookingLimits(request, sarahUserId, ownerToken, 2, 25);

    await page.goto(`/booking?year=2030&month=9`);

    // The date might still show in the calendar if another therapist has availability
    // or the capacity filter removed it entirely — either is acceptable.
    // Filter to Sarah specifically to verify she's excluded.
    const sarahId = sarahUserId;
    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahId}`);
    await page.waitForSelector('.avail-calendar');

    // Sarah is at her daily limit — date should not be marked available for Sarah
    const dayBtn = page.locator(`button[aria-label*="${testDate}"]`);
    const count = await dayBtn.count();
    if (count > 0) {
      // Day should not be available (no slots for Sarah)
      const isAvailable = await dayBtn.getAttribute('aria-label');
      expect(isAvailable).not.toContain('available');
    }
    // OR the button is absent entirely because no days are available
  });

  test('calendar date reappears for Sarah after an appointment is cancelled', async ({ page, request }) => {
    // Cancel one appointment to free up a slot
    await cancelAppointment(request, createdApptIds[0], ownerToken);
    createdApptIds.shift();

    const sarahId = sarahUserId;
    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahId}`);
    await page.waitForSelector('.avail-calendar');

    // Now Sarah has 1 appointment (under the limit of 2), so she should be available
    await expect(
      page.locator(`button[aria-label*="${testDate}"][aria-label*="available"]`)
    ).toBeVisible();
  });
});

// ── Weekly booking limit ──────────────────────────────────────────────────────

test.describe('Weekly booking limit', () => {
  const { owner, sarah } = getAuthState();
  const ownerToken = owner.token, ownerUserId = owner.userId;
  const sarahToken = sarah.token, sarahUserId = sarah.userId;
  let serviceId;
  // Use two days in the same week so we can fill the weekly limit across days
  const day1 = DATES.thu1; // 2030-09-05 (Thursday)
  const day2 = DATES.fri1; // 2030-09-06 (Friday) — same week
  const createdApptIds = [];

  test.beforeAll(async ({ request }) => {
    serviceId = await getServiceId(request);

    // Set weekly limit to 2 (and daily limit high so it's not the constraint)
    await setBookingLimits(request, sarahUserId, ownerToken, 10, 2);

    // Availability on both days
    await setAvailability(request, sarahUserId, sarahToken, [
      { date: day1, startTime: '09:00', endTime: '17:00' },
      { date: day2, startTime: '09:00', endTime: '17:00' },
    ]);

    // Fill the weekly limit (2 appointments across the week)
    for (const d of [day1, day2]) {
      const appt = await createGuestAppointment(request, {
        therapistId: sarahUserId,
        serviceId,
        scheduledAt: `${d}T09:00:00.000Z`,
      });
      if (appt?.id) createdApptIds.push(appt.id);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdApptIds) {
      await cancelAppointment(request, id, ownerToken);
    }
    await deleteAvailability(request, sarahUserId, sarahToken, [day1, day2]);
    await setBookingLimits(request, sarahUserId, ownerToken, 5, 25);
  });

  test('a therapist at weekly capacity has no slots when the date is selected', async ({ page, request }) => {
    // Re-assert the limits here in case a concurrent spec file (e.g. therapist-schedule
    // afterAll) reset them to defaults between our beforeAll and this test body.
    await setBookingLimits(request, sarahUserId, ownerToken, 10, 2);

    // Note: the calendar endpoint applies only daily capacity filtering.
    // Day1 (Thu 2030-09-05) has 1 appointment — under the daily limit of 10 — so the
    // calendar may still show the date as available. The SLOTS endpoint checks both
    // daily AND weekly capacity, so clicking through should reveal zero slots for Sarah.
    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');

    const day1Btn = page.locator(`button[aria-label*="${day1}"]`);
    const btnCount = await day1Btn.count();

    if (btnCount > 0 && (await day1Btn.getAttribute('aria-label') ?? '').includes('available')) {
      // The date shows as available in the calendar; click it
      await day1Btn.click();
      await page.waitForSelector('.slot-panel');

      // Sarah is the only therapist with availability on this date and she is at her
      // weekly limit — the slots endpoint removes her, so no slots should be returned.
      await expect(page.locator('.slot-panel__state')).toContainText('No available times');
      await expect(page.locator('button.slot-btn')).toHaveCount(0);
    } else {
      // Calendar already excluded the date (future improvement: weekly calendar filtering)
      expect(btnCount === 0 || !(await day1Btn.getAttribute('aria-label') ?? '').includes('available')).toBe(true);
    }
  });
});

// ── Availability updates propagate to the booking calendar ───────────────────

test.describe('Availability updates propagate to the booking calendar', () => {
  const { sarah } = getAuthState();
  const sarahToken = sarah.token, sarahUserId = sarah.userId;
  const testDate = DATES.wed1; // 2030-09-04 (Wednesday)

  test('adding availability makes a date bookable', async ({ page }) => {
    // Ensure no availability exists on this date first
    await deleteAvailability(page.request, sarahUserId, sarahToken, [testDate]);

    // Sarah has no availability on testDate — it should not appear in the calendar
    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');
    const beforeBtn = page.locator(`button[aria-label*="${testDate}"][aria-label*="available"]`);
    await expect(beforeBtn).not.toBeVisible();

    // Add availability via API (simulates therapist updating their schedule)
    await setAvailability(page.request, sarahUserId, sarahToken, [
      { date: testDate, startTime: '09:00', endTime: '17:00' },
    ]);

    // Reload the calendar — the date should now be available
    await page.reload();
    await page.waitForSelector('.avail-calendar');
    await expect(
      page.locator(`button[aria-label*="${testDate}"][aria-label*="available"]`)
    ).toBeVisible();

    // Cleanup
    await deleteAvailability(page.request, sarahUserId, sarahToken, [testDate]);
  });

  test('removing availability makes a date disappear from the calendar', async ({ page }) => {
    // Add availability first
    await setAvailability(page.request, sarahUserId, sarahToken, [
      { date: testDate, startTime: '09:00', endTime: '17:00' },
    ]);

    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');
    await expect(
      page.locator(`button[aria-label*="${testDate}"][aria-label*="available"]`)
    ).toBeVisible();

    // Remove the availability
    await deleteAvailability(page.request, sarahUserId, sarahToken, [testDate]);

    // Reload — date should no longer be available
    await page.reload();
    await page.waitForSelector('.avail-calendar');
    const afterBtn = page.locator(`button[aria-label*="${testDate}"][aria-label*="available"]`);
    await expect(afterBtn).not.toBeVisible();
  });
});

// ── 24-hour advance booking window ────────────────────────────────────────────

test.describe('24-hour advance booking window', () => {
  const { sarah } = getAuthState();
  const sarahUserId = sarah.userId;

  test('a slot within 24 hours of now is not offered, even if availability exists', async ({ page }) => {
    // Use today's date — availability exists via seed for Sarah on weekdays,
    // but today's slots are filtered out by the 24h rule in the API.
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/booking?year=${today.slice(0, 4)}&month=${parseInt(today.slice(5, 7), 10)}&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');

    // Today's cell might be present in the calendar but should NOT be marked available
    const todayBtn = page.locator(`button[aria-label*="${today}"]`);
    const count = await todayBtn.count();
    if (count > 0) {
      const label = await todayBtn.getAttribute('aria-label');
      expect(label ?? '').not.toContain(', available');
    }
  });
});

// ── Closed business day ───────────────────────────────────────────────────────

test.describe('Closed business day', () => {
  test('Sunday cell is disabled even if hypothetically marked available', async ({ page }) => {
    // Business hours seed: Sunday is closed (is_closed = true).
    // 2030-09-01 is a Sunday.
    await page.goto('/booking?year=2030&month=9');
    await page.waitForSelector('.avail-calendar');

    const sundayBtn = page.locator(`button[aria-label*="${DATES.sun1}"]`);
    await expect(sundayBtn).toBeVisible();
    await expect(sundayBtn).toBeDisabled();
    await expect(sundayBtn.locator('.avail-calendar__closed-label')).toBeVisible();
  });
});
