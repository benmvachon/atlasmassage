/**
 * E2E tests for the therapist dashboard client history and SOAP notes features.
 *
 * Setup: creates a completed guest appointment with Sarah as therapist so that
 * the SOAP notes form and client history modal can be exercised.
 */
import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, getAuthState, loginInBrowser,
  setAvailability, deleteAvailability, getServiceId,
  createGuestAppointment, debugHeaders,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

// January 2031 — dedicated month to avoid conflicts with all other test suites
const HIST_DATE     = '2031-01-06'; // Monday — main history / SOAP tests
const HIST_DATE_DOB = '2031-01-07'; // Tuesday — DOB-specific UI tests

const { owner, sarah } = getAuthState();
const SARAH_ID    = sarah.userId;
const SARAH_TOKEN = sarah.token;
const OWNER_TOKEN = owner.token;

let completedApptId = null;
let dobApptId       = null;
let noDobApptId     = null;

test.beforeAll(async ({ request }) => {
  // Remove any leftover data from previous runs
  await Promise.all([
    request.delete(`/api/v1/debug/appointments/${SARAH_ID}/${HIST_DATE}`,     { headers: debugHeaders() }),
    request.delete(`/api/v1/debug/appointments/${SARAH_ID}/${HIST_DATE_DOB}`, { headers: debugHeaders() }),
  ]);

  const serviceId = await getServiceId(request);

  await setAvailability(request, SARAH_ID, SARAH_TOKEN, [
    { date: HIST_DATE,     startTime: '09:00', endTime: '17:00' },
    { date: HIST_DATE_DOB, startTime: '09:00', endTime: '17:00' },
  ]);

  // Main appointment — no DOB (tests the SOAP flow)
  const appt = await createGuestAppointment(request, {
    therapistId: SARAH_ID,
    serviceId,
    scheduledAt: `${HIST_DATE}T10:00:00.000Z`,
  });
  expect(appt).not.toBeNull();

  // DOB appointment — unique guest email so history has exactly one session
  const dobAppt = await createGuestAppointment(request, {
    therapistId: SARAH_ID,
    serviceId,
    scheduledAt: `${HIST_DATE_DOB}T10:00:00.000Z`,
    healthDateOfBirth: '1985-03-22',
    guestEmail: 'e2e-dob@test.invalid',
  });
  expect(dobAppt).not.toBeNull();

  // No-DOB appointment on same day at 13:00 (clear gap after DOB at 10:00), unique email
  const noDobAppt = await createGuestAppointment(request, {
    therapistId: SARAH_ID,
    serviceId,
    scheduledAt: `${HIST_DATE_DOB}T13:00:00.000Z`,
    guestEmail: 'e2e-nodob@test.invalid',
  });
  expect(noDobAppt).not.toBeNull();

  await Promise.all([
    request.post(`/api/v1/appointments/${appt.id}/complete`,     { headers: { Authorization: `Bearer ${OWNER_TOKEN}` } }),
    request.post(`/api/v1/appointments/${dobAppt.id}/complete`,  { headers: { Authorization: `Bearer ${OWNER_TOKEN}` } }),
    request.post(`/api/v1/appointments/${noDobAppt.id}/complete`, { headers: { Authorization: `Bearer ${OWNER_TOKEN}` } }),
  ]);

  completedApptId = appt.id;
  dobApptId       = dobAppt.id;
  noDobApptId     = noDobAppt.id;
});

test.afterAll(async ({ request }) => {
  await Promise.all([
    request.delete(`/api/v1/debug/appointments/${SARAH_ID}/${HIST_DATE}`,     { headers: debugHeaders() }),
    request.delete(`/api/v1/debug/appointments/${SARAH_ID}/${HIST_DATE_DOB}`, { headers: debugHeaders() }),
  ]);
  await deleteAvailability(request, SARAH_ID, SARAH_TOKEN, [HIST_DATE, HIST_DATE_DOB]);
});

async function goToBookings(page) {
  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/bookings');
  await page.waitForSelector('.owner-table');
}

// ── SOAP notes ────────────────────────────────────────────────────────────────

test('completed appointment shows SOAP notes missing badge', async ({ page }) => {
  await goToBookings(page);
  await expect(page.locator('.soap-badge--missing').first()).toBeVisible();
});

test('"Write SOAP Notes" button opens the SOAP notes form', async ({ page }) => {
  await goToBookings(page);
  await page.locator('button:has-text("Write SOAP Notes")').first().click();
  await page.waitForSelector('.soap-modal');
  await expect(page.locator('.soap-modal')).toBeVisible();
  // Session meta should show the client and service
  await expect(page.locator('.soap-modal__meta')).toBeVisible();
});

test('SOAP notes save button is disabled until all four fields are filled', async ({ page }) => {
  await goToBookings(page);
  await page.locator('button:has-text("Write SOAP Notes")').first().click();
  await page.waitForSelector('.soap-modal');

  const saveBtn = page.locator('.soap-modal button[type="submit"]');
  await expect(saveBtn).toBeDisabled();

  await page.fill('#soap-subjective', 'Client reports neck stiffness.');
  await page.fill('#soap-objective', 'Limited ROM in cervical spine.');
  await page.fill('#soap-assessment', 'Muscle tension from desk work.');
  await expect(saveBtn).toBeDisabled(); // plan still empty

  await page.fill('#soap-plan', 'Deep tissue on upper traps. Weekly sessions.');
  await expect(saveBtn).toBeEnabled();
});

test('saving SOAP notes updates the badge to SOAP done', async ({ page }) => {
  await goToBookings(page);
  await page.locator('button:has-text("Write SOAP Notes")').first().click();
  await page.waitForSelector('.soap-modal');

  await page.fill('#soap-subjective', 'Client reports neck stiffness.');
  await page.fill('#soap-objective', 'Limited ROM in cervical spine.');
  await page.fill('#soap-assessment', 'Muscle tension from desk work.');
  await page.fill('#soap-plan', 'Deep tissue on upper traps. Weekly sessions.');

  await page.locator('.soap-modal button[type="submit"]').click();

  // Modal closes and the done badge appears
  await expect(page.locator('.soap-modal')).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator('.soap-badge--done').first()).toBeVisible();
});

test('reopening the form shows the previously saved SOAP notes', async ({ page }) => {
  await goToBookings(page);

  // After the previous test saved notes, button text should change to "Edit"
  await page.locator('button:has-text("Edit SOAP Notes")').first().click();
  await page.waitForSelector('.soap-modal');

  await expect(page.locator('#soap-subjective')).toHaveValue('Client reports neck stiffness.');
  await expect(page.locator('#soap-plan')).toHaveValue('Deep tissue on upper traps. Weekly sessions.');
});

// ── Client history ────────────────────────────────────────────────────────────

test('"Client History" button opens the history modal', async ({ page }) => {
  await goToBookings(page);
  await page.locator('button:has-text("Client History")').first().click();
  await page.waitForSelector('.history-modal');

  await expect(page.locator('.history-modal')).toBeVisible();
  // Modal header should show the client identifier
  await expect(page.locator('.history-modal__client')).toBeVisible();
});

test('history modal shows a session entry with record type chips', async ({ page }) => {
  await goToBookings(page);
  await page.locator('button:has-text("Client History")').first().click();
  await page.waitForSelector('.history-session');

  const session = page.locator('.history-session').first();
  await expect(session).toBeVisible();

  // At minimum the intake chip should be present (appointment had health record)
  const chips = session.locator('.history-chip');
  await expect(chips.first()).toBeVisible();
});

test('expanding a history session reveals the SOAP notes record', async ({ page }) => {
  await goToBookings(page);
  await page.locator('button:has-text("Client History")').first().click();
  await page.waitForSelector('.history-session');

  await page.locator('.history-session__header').first().click();
  await page.waitForSelector('.history-session__records');

  // SOAP notes record should be visible (saved in the SOAP notes tests above)
  // Use div selector to avoid matching the .history-chip spans that share the --soap modifier class
  await expect(page.locator('div.history-record--soap')).toBeVisible();
  await expect(page.locator('div.history-record--soap')).toContainText('Subjective');
  await expect(page.locator('div.history-record--soap')).toContainText('neck stiffness');
});

// ── Date of birth ─────────────────────────────────────────────────────────────

test('date of birth appears in the Medical Intake record when provided', async ({ page }) => {
  await goToBookings(page);

  // Find the row for the DOB appointment and open client history for it
  const dobRow = page.locator('tr', { hasText: 'e2e-dob@test.invalid' }).first();
  await dobRow.locator('button:has-text("Client History")').click();
  await page.waitForSelector('.history-session');

  // Expand the session entry
  await page.locator('.history-session__header').first().click();
  await page.waitForSelector('.history-session__records');

  // The Medical Intake record should show the date of birth
  const intakeRecord = page.locator('div.history-record--intake');
  await expect(intakeRecord).toBeVisible();
  await expect(intakeRecord.locator('dt', { hasText: 'Date of birth' })).toBeVisible();
  // Formatted as long-form date: "March 22, 1985"
  await expect(intakeRecord.locator('dd', { hasText: 'March 22, 1985' })).toBeVisible();
});

test('date of birth is absent from Medical Intake when not provided', async ({ page }) => {
  await goToBookings(page);

  // Use the dedicated no-DOB guest (one session in history — avoids multi-session
  // layout issues that can make the session header unclickable)
  const noDobRow = page.locator('tr', { hasText: 'e2e-nodob@test.invalid' }).first();
  await noDobRow.locator('button:has-text("Client History")').click();
  await page.waitForSelector('.history-session');

  await page.locator('.history-session__header').first().click();
  await page.waitForSelector('.history-session__records');

  const intakeRecord = page.locator('div.history-record--intake');
  await expect(intakeRecord).toBeVisible();
  await expect(intakeRecord.locator('dt', { hasText: 'Date of birth' })).not.toBeVisible();
});
