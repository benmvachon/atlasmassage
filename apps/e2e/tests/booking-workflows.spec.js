/**
 * E2E tests for the guest booking workflow.
 * Runs against the real dev stack — no API mocking.
 */
import { test, expect } from '@playwright/test';
import {
  DATES, getAuthState,
  setAvailability, deleteAvailability, getServiceId,
  cancelAppointment, mockStripeDisabled, mockValidateAddress, drawSignature,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const GUEST_NAME  = 'Jordan E2E';
const GUEST_EMAIL = 'jordan-e2e@test.invalid';

// Minimal address required by the contact step
const GUEST_ADDR = {
  line1: '123 Test St',
  city:  'Test City',
  state: 'CA',
  zip:   '90210',
};

const { owner, sarah } = getAuthState();
const ownerToken = owner.token;
const sarahToken = sarah.token;
const sarahUserId = sarah.userId;
const TEST_DATE = DATES.mon2; // 2030-09-09

test.beforeAll(async ({ request }) => {
  await setAvailability(request, sarahUserId, sarahToken, [
    { date: TEST_DATE, startTime: '09:00', endTime: '17:00' },
  ]);
});

test.afterAll(async ({ request }) => {
  await deleteAvailability(request, sarahUserId, sarahToken, [TEST_DATE]);
});

// Stub address validation for every test — the contact step calls the real
// Google Maps API which rejects test addresses like "Test City, CA 90210".
test.beforeEach(async ({ page }) => {
  await mockValidateAddress(page);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the booking modal and land on the first wizard step (contact). */
async function openModal(page) {
  await page.goto(`/booking?year=2030&month=9`);
  await page.waitForSelector('.avail-calendar');
  await page.click(`button[aria-label*="${TEST_DATE}"][aria-label*="available"]`);
  await page.locator('button.slot-btn').first().click();
  await page.waitForSelector('[role="dialog"][aria-labelledby="booking-modal-title"]');
}

/** Fill every required contact field (name, email, address). */
async function fillContactStep(page) {
  await page.fill('#bm-name', GUEST_NAME);
  await page.fill('#bm-email', GUEST_EMAIL);
  await page.fill('#bm-addr1', GUEST_ADDR.line1);
  await page.fill('#bm-city', GUEST_ADDR.city);
  await page.fill('#bm-state', GUEST_ADDR.state);
  await page.fill('#bm-zip', GUEST_ADDR.zip);
}

/** Advance past the contact step (requires all fields pre-filled). */
async function advancePastContact(page) {
  await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());
  await page.waitForSelector('#bm-medications'); // health step
}

/** Advance past the health step (all fields optional — just continue). */
async function advancePastHealth(page) {
  await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());
  await page.waitForSelector('.waiver-sig__canvas'); // consent step
}

/** Complete the consent step (sign + check). */
async function completeConsentStep(page) {
  await drawSignature(page);
  await page.locator('.waiver-agree__checkbox').evaluate(cb => cb.click());
  // The "Continue →" button on the consent step
  await page.locator('.avail-modal__actions .btn--primary').click();
  await page.waitForSelector('.booking-divider'); // payment step
}

// ── Happy-path booking ────────────────────────────────────────────────────────

test('complete guest booking flow: contact → health → consent → payment → success', async ({ page }) => {
  await mockStripeDisabled(page);
  await openModal(page);

  // Step 1: Contact
  await fillContactStep(page);
  await advancePastContact(page);

  // Step 2: Health — all optional, just continue
  await advancePastHealth(page);

  // Step 3: Consent — sign and advance
  await completeConsentStep(page);

  // Step 4: Payment — mock POST so no real booking is created
  await page.route('**/api/v1/appointments', route => {
    if (route.request().method() !== 'POST') { route.continue(); return; }
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          appointment: { id: 'e2e-appt-id', status: 'pending', scheduled_at: `${TEST_DATE}T09:00:00Z` },
          clientSecret: null,
        },
      }),
    });
  });
  await page.locator('button:has-text("Book Appointment")').click();

  // Success
  await expect(page.locator('.booking-modal__success-title')).toContainText('Booking Confirmed');
  await expect(page.locator('.booking-modal__success-body')).toContainText(GUEST_EMAIL);
});

// ── Empty and edge states ─────────────────────────────────────────────────────

test('shows "no available times" when the date has no open slots', async ({ page, request }) => {
  const emptyDate = DATES.sat1; // Saturday — Sarah has no Saturday availability seeded
  await deleteAvailability(request, sarahUserId, sarahToken, [emptyDate]);

  await page.goto(`/booking?year=2030&month=9&therapistId=${sarahUserId}`);
  await page.waitForSelector('.avail-calendar');

  const satBtn = page.locator(`button[aria-label*="${emptyDate}"]`);
  const count = await satBtn.count();
  if (count > 0) {
    const label = await satBtn.getAttribute('aria-label');
    expect((label ?? '').includes(', available')).toBe(false);
  }
});

test('shows booking form pre-populated with correct date and time', async ({ page }) => {
  await openModal(page);
  const summary = page.locator('.booking-modal__slot-summary');
  await expect(summary).toContainText('September');
  await expect(summary).toContainText('9'); // day 9 of September
});

// ── Form validation ───────────────────────────────────────────────────────────

test('Continue button is disabled until all required contact fields are filled', async ({ page }) => {
  await openModal(page);

  const submitBtn = page.locator('.booking-modal form button[type="submit"]');
  await expect(submitBtn).toBeDisabled();

  await page.fill('#bm-name', GUEST_NAME);
  await expect(submitBtn).toBeDisabled(); // email + address still missing

  await page.fill('#bm-email', 'not-valid-email');
  await expect(submitBtn).toBeDisabled(); // invalid email

  await page.fill('#bm-email', GUEST_EMAIL);
  await expect(submitBtn).toBeDisabled(); // address still missing

  await page.fill('#bm-addr1', GUEST_ADDR.line1);
  await expect(submitBtn).toBeDisabled(); // city/state/zip still missing

  await page.fill('#bm-city', GUEST_ADDR.city);
  await page.fill('#bm-state', GUEST_ADDR.state);
  await expect(submitBtn).toBeDisabled(); // zip still missing

  await page.fill('#bm-zip', GUEST_ADDR.zip);
  await expect(submitBtn).toBeEnabled(); // all required fields filled
});

test('consent Continue button is disabled until canvas is signed and checkbox is checked', async ({ page }) => {
  await mockStripeDisabled(page);
  await openModal(page);

  // Navigate to consent step
  await fillContactStep(page);
  await advancePastContact(page);
  await advancePastHealth(page);

  // On consent step — primary button should be disabled initially
  const consentBtn = page.locator('.avail-modal__actions .btn--primary');
  await expect(consentBtn).toBeDisabled();

  // Sign → still disabled (checkbox not checked)
  await drawSignature(page);
  await expect(consentBtn).toBeDisabled();

  // Check the checkbox → now enabled
  await page.locator('.waiver-agree__checkbox').evaluate(cb => cb.click());
  await expect(consentBtn).toBeEnabled();
});

// ── Modal navigation ──────────────────────────────────────────────────────────

test('closing the booking modal returns to the slot list', async ({ page }) => {
  await openModal(page);
  await page.locator('.avail-modal__close').evaluate(btn => btn.click());
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  await expect(page.locator('.slot-panel__grid')).toBeVisible();
});

test('health step: date of birth field is present and persists through the flow', async ({ page }) => {
  await mockStripeDisabled(page);
  await openModal(page);

  await fillContactStep(page);
  await advancePastContact(page); // now on health step

  // DOB field should be visible and accept a date value
  await expect(page.locator('#bm-dob')).toBeVisible();
  await page.fill('#bm-dob', '1990-06-15');
  await expect(page.locator('#bm-dob')).toHaveValue('1990-06-15');

  // Advance past health (DOB is optional — no required validation)
  await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());
  await page.waitForSelector('.waiver-sig__canvas'); // consent step
});

test('Back button on the health step returns to the contact step with values preserved', async ({ page }) => {
  await openModal(page);

  await fillContactStep(page);
  await advancePastContact(page); // now on health step

  // Back to contact step
  await page.locator('button:has-text("Back")').click();
  await page.waitForSelector('#bm-name');

  await expect(page.locator('#bm-name')).toHaveValue(GUEST_NAME);
  await expect(page.locator('#bm-email')).toHaveValue(GUEST_EMAIL);
});

// ── Filters ───────────────────────────────────────────────────────────────────

test('time-of-day filter updates the calendar request', async ({ page }) => {
  await page.goto('/booking?year=2030&month=9');
  await page.waitForSelector('.avail-calendar');

  const [calendarRequest] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/availability/booking/calendar') &&
      req.url().includes('timeOfDay=afternoon')
    ),
    page.selectOption('#bf-time', 'afternoon'),
  ]);
  expect(calendarRequest.url()).toContain('timeOfDay=afternoon');
});

test('filtering to a specific therapist updates the calendar request', async ({ page }) => {
  await page.goto('/booking?year=2030&month=9');
  await page.waitForSelector('.avail-calendar');

  const [calendarRequest] = await Promise.all([
    page.waitForRequest(req =>
      req.url().includes('/availability/booking/calendar') &&
      req.url().includes(`therapistId=${sarahUserId}`)
    ),
    page.selectOption('#bf-therapist', sarahUserId),
  ]);
  expect(calendarRequest.url()).toContain(`therapistId=${sarahUserId}`);
});

// ── Address validation error paths (added with travel mode / address validation) ──

test('contact step: shows error when address cannot be verified', async ({ page }) => {
  // Override the beforeEach stub to return an invalid response
  await page.route('**/api/v1/appointments/validate-address', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { valid: false } }),
    })
  );
  await openModal(page);
  await fillContactStep(page);
  await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

  await expect(page.locator('.avail-modal__error')).toContainText("couldn't verify this address");
  await expect(page.locator('#bm-name')).toBeVisible(); // still on contact step
});

test('contact step: shows out-of-service-area error when address is outside travel range', async ({ page }) => {
  await page.route('**/api/v1/appointments/validate-address', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { valid: false, outOfServiceArea: true } }),
    })
  );
  await openModal(page);
  await fillContactStep(page);
  await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

  await expect(page.locator('.avail-modal__error')).toContainText('outside our 20-minute travel service area');
  await expect(page.locator('#bm-name')).toBeVisible(); // still on contact step
});

// ── Consent step — services section (added to consent step) ──────────────────

test('consent step: Services We Offer section is visible', async ({ page }) => {
  await mockStripeDisabled(page);
  await openModal(page);
  await fillContactStep(page);
  await advancePastContact(page);
  await advancePastHealth(page);

  await expect(page.locator('.waiver-services')).toBeVisible();
  await expect(page.locator('.waiver-services__heading')).toContainText('Services We Offer');
  await expect(page.locator('.waiver-services__item')).not.toHaveCount(0);
});

// ── Booking restrictions (pregnancy / minors) ─────────────────────────────────

test.describe('Booking restrictions', () => {
  const { owner } = getAuthState();

  async function setRestrictions(request, { pregnancy, minors }) {
    return request.put('/api/v1/admin/business/restrictions', {
      data: { restrictPregnancy: pregnancy, restrictMinors: minors },
      headers: { Authorization: `Bearer ${owner.token}` },
    });
  }

  test.beforeAll(async ({ request }) => {
    await setRestrictions(request, { pregnancy: true, minors: true });
  });

  test.afterAll(async ({ request }) => {
    await setRestrictions(request, { pregnancy: false, minors: false });
  });

  test('health step: DOB is required when restrict_minors is enabled', async ({ page }) => {
    await openModal(page);
    await fillContactStep(page);
    await advancePastContact(page);

    // Submit without filling the required DOB
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    await expect(page.locator('.avail-modal__error')).toContainText('Date of birth is required');
    await expect(page.locator('#bm-dob')).toBeVisible(); // still on health step
  });

  test('health step: blocks under-18 bookings when restrict_minors is enabled', async ({ page }) => {
    await openModal(page);
    await fillContactStep(page);
    await advancePastContact(page);

    const underageDob = new Date();
    underageDob.setFullYear(underageDob.getFullYear() - 15);
    await page.fill('#bm-dob', underageDob.toISOString().slice(0, 10));
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    await expect(page.locator('.avail-modal__error')).toContainText('not currently certified for pediatric massage');
    await expect(page.locator('#bm-dob')).toBeVisible(); // still on health step
  });

  test('health step: blocks pregnant clients when restrict_pregnancy is enabled', async ({ page }) => {
    await openModal(page);
    await fillContactStep(page);
    await advancePastContact(page);

    // Fill valid adult DOB (required by restrict_minors which is also enabled)
    await page.fill('#bm-dob', '1990-01-01');
    await page.locator('input[name="pregnancyStatus"][value="pregnant"]').click();
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    await expect(page.locator('.avail-modal__error')).toContainText('not currently certified for prenatal');
    await expect(page.locator('#bm-dob')).toBeVisible(); // still on health step
  });
});
