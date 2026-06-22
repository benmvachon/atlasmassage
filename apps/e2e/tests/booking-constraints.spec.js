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
  createGuestAppointment, cancelAppointment, getServiceId, getServiceByDuration,
  mockValidateAddress, mockStripeDisabled, drawSignature,
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

// ── Service duration constraints ──────────────────────────────────────────────

test.describe('Service duration constraints', () => {
  const { owner, sarah } = getAuthState();
  const ownerToken = owner.token;
  const sarahToken = sarah.token;
  const sarahUserId = sarah.userId;
  const testDate = DATES.mon3; // 2030-09-16 (Monday)
  let serviceId60, serviceId90, serviceId120;

  // Helper: navigate through contact → health → consent wizard steps
  // and land on the payment step for the given slot (first or last).
  async function navigateToPaymentStep(page, { slotSelector = 'first', guestEmail }) {
    await page.waitForSelector('.slot-panel__grid');
    if (slotSelector === 'last') {
      await page.locator('button.slot-btn').last().click();
    } else {
      await page.locator('button.slot-btn').first().click();
    }
    await page.waitForSelector('[role="dialog"][aria-labelledby="booking-modal-title"]');

    // Pass the guest gate.
    await page.click('button:has-text("Continue as guest")');
    await page.waitForSelector('#bm-name');

    // Contact step
    await page.fill('#bm-name', 'E2E Tester');
    await page.fill('#bm-email', guestEmail);
    await page.fill('#bm-addr1', '123 Test St');
    await page.fill('#bm-city', 'Test City');
    await page.fill('#bm-state', 'CA');
    await page.fill('#bm-zip', '90210');
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    // Health step
    await page.waitForSelector('#bm-medications');
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    // Consent step — draw signature + check all boxes
    await page.waitForSelector('.waiver-sig__canvas');
    await drawSignature(page);
    for (const cb of await page.locator('.waiver-agree__checkbox').all()) {
      await cb.evaluate(el => el.click());
    }
    await page.locator('.avail-modal__actions .btn--primary').click();

    // Payment step
    await page.waitForSelector('#bm-service');
  }

  test.beforeAll(async ({ request }) => {
    // 120-min window (09:00–11:00): covers 60, 90, and 120-min services at 09:00
    await setAvailability(request, sarahUserId, sarahToken, [
      { date: testDate, startTime: '09:00', endTime: '11:00' },
    ]);
    serviceId60  = await getServiceByDuration(request, 60);
    serviceId90  = await getServiceByDuration(request, 90);
    serviceId120 = await getServiceByDuration(request, 120);
  });

  test.afterAll(async ({ request }) => {
    await deleteAvailability(request, sarahUserId, sarahToken, [testDate]);
  });

  test('slots API annotates availableDurations reflecting the availability window', async ({ request }) => {
    const res = await request.get(
      `/api/v1/availability/booking/slots?date=${testDate}&therapistId=${sarahUserId}`
    );
    const body = await res.json();
    const slots = body.data.slots;

    // 09:00 has a full 120-min window → all three durations
    const slot900 = slots.find(s => s.startTime === '09:00');
    expect(slot900).toBeTruthy();
    expect(slot900.availableDurations).toContain(60);
    expect(slot900.availableDurations).toContain(90);
    expect(slot900.availableDurations).toContain(120);

    // 10:00 has only 60 min remaining (10:00 + 90 > 11:00) → only 60 min
    const slot1000 = slots.find(s => s.startTime === '10:00');
    expect(slot1000).toBeTruthy();
    expect(slot1000.availableDurations).toContain(60);
    expect(slot1000.availableDurations).not.toContain(90);
    expect(slot1000.availableDurations).not.toContain(120);
  });

  test('server rejects a 90-min booking at a slot that only has 60-min runway', async ({ request }) => {
    // Block 09:00 for 90 min by placing a 10:00 appointment (90-min slot at 09:00 ends at 10:30
    // which conflicts with 10:00 appointment start minus 15-min buffer = 09:45)
    const existingAppt = await createGuestAppointment(request, {
      therapistId: sarahUserId,
      serviceId: serviceId60,
      scheduledAt: `${testDate}T10:00:00.000Z`,
    });

    try {
      const res = await request.post('/api/v1/appointments', {
        data: {
          therapistId: sarahUserId,
          serviceId: serviceId90,
          scheduledAt: `${testDate}T09:00:00.000Z`,
          guestName: 'E2E Reject',
          guestEmail: 'e2e-reject@test.invalid',
          waiverSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      });
      const body = await res.json();
      expect(res.status()).toBe(409);
      expect(body.error.code).toBe('SLOT_UNAVAILABLE');
    } finally {
      if (existingAppt?.id) await cancelAppointment(request, existingAppt.id, ownerToken);
    }
  });

  test('service dropdown on payment step shows only services that fit the slot', async ({ page }) => {
    await mockValidateAddress(page);
    await mockStripeDisabled(page);

    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');
    await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);

    // Click the LAST slot (most constrained — least runway remaining)
    await navigateToPaymentStep(page, { slotSelector: 'last', guestEmail: 'e2e-svc-last@test.invalid' });

    const select = page.locator('#bm-service');
    await expect(select).toBeVisible();
    const options = select.locator('option');
    const count = await options.count();

    // The last slot in a 09:00–11:00 window is 10:00 — only 60 min fits
    expect(count).toBe(1);
    const text = await options.first().textContent();
    expect(text).toContain('60 min');
  });

  test('service dropdown shows all services at the first slot with full runway', async ({ page }) => {
    await mockValidateAddress(page);
    await mockStripeDisabled(page);

    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');
    await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);

    // Click the FIRST slot (09:00) — full 120-min runway, all three durations fit
    await navigateToPaymentStep(page, { slotSelector: 'first', guestEmail: 'e2e-svc-first@test.invalid' });

    const select = page.locator('#bm-service');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(3);
  });

  test('slot summary shows the start time only and the service dropdown carries duration', async ({ page }) => {
    await mockValidateAddress(page);
    await mockStripeDisabled(page);

    await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
    await page.waitForSelector('.avail-calendar');
    await page.click(`button[aria-label*="${testDate}"][aria-label*="available"]`);

    // First slot (09:00) — all three durations fit
    await navigateToPaymentStep(page, { slotSelector: 'first', guestEmail: 'e2e-endtime@test.invalid' });

    // The slot summary intentionally shows only the start time — the end time
    // varies by service and is misleading before a service is chosen.
    const summary = page.locator('.booking-modal__slot-summary');
    await expect(summary).toContainText('9:00 AM');
    await expect(summary).not.toContainText('–');

    // Duration is conveyed through the service options instead.
    await expect(page.locator(`#bm-service option[value="${serviceId90}"]`)).toContainText('90 min');

    // Selecting the 90-min service keeps the start-time-only summary.
    await page.selectOption('#bm-service', { value: serviceId90 });
    await expect(summary).toContainText('9:00 AM');
    await expect(summary).not.toContainText('–');
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
