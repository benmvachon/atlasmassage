/**
 * E2E tests for email/SMS notifications and the cron worker that schedules them.
 *
 * Covered scenarios:
 *   1. Notification Preferences UI  — Notifications tab in /settings
 *   2. Notification Preferences API — GET / PUT /api/v1/notifications/preferences
 *   3. Booking Confirmation         — email logged for therapist on guest booking
 *   4. Cron: 24h Reminder           — logged for client + therapist, deduplicated
 *   5. Cron: Reminder preference    — suppressed when email_appointment_remind=false
 *   6. Cron: Feedback Request       — logged 24h after a completed appointment
 *   7. Cron: Week Followup          — logged 7 days after, skipped when future appt exists
 *   8. Cron: Month Followup         — logged 30 days after
 *   9. Notification History API     — GET /api/v1/notifications requires auth
 *
 * In dev mode the email/SMS transports fall back to console logging, but the
 * notifications table is still written — so all assertions check DB records via
 * the /api/v1/notifications endpoint.
 *
 * The /debug/trigger-notifications endpoint runs all four cron jobs synchronously,
 * so no timing uncertainty for those tests.  Booking-confirmation notifications fire
 * asynchronously from the appointment controller, so those use pollForNotification().
 *
 * December 2030 is reserved for this suite — no other spec uses those dates.
 */
import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, getAuthState, loginInBrowser,
  setAvailability, deleteAvailability, getServiceId,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const { client, sarah } = getAuthState();
const CLIENT_ID    = client.userId;
const CLIENT_TOKEN = client.token;
const SARAH_ID     = sarah.userId;
const SARAH_TOKEN  = sarah.token;

// December 2030 — dedicated to notification tests
const NOTIF_DATE = '2030-12-03'; // Monday (Dec 1 is Saturday)

let serviceId;
const createdApptIds = [];

// ── Local helpers ─────────────────────────────────────────────────────────────

async function getNotifications(request, token) {
  const res  = await request.get('/api/v1/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return body.data.notifications;
}

async function getPreferences(request, token) {
  const res  = await request.get('/api/v1/notifications/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return body.data.preferences;
}

async function setPreferences(request, token, prefs) {
  const res = await request.put('/api/v1/notifications/preferences', {
    data:    prefs,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function triggerNotifications(request) {
  const res = await request.post('/api/v1/debug/trigger-notifications');
  expect(res.ok()).toBe(true);
}

async function createBackdatedAppt(request, { therapistId, serviceId: svcId, clientId, scheduledAt, status = 'confirmed' }) {
  const res  = await request.post('/api/v1/debug/appointments/backdated', {
    data: { therapistId, serviceId: svcId, clientId, scheduledAt, status },
  });
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data.appointment;
}

async function cancelApptById(request, appointmentId) {
  await request.delete(`/api/v1/debug/appointments/${appointmentId}`);
}

async function cancelClientFutureAppts(request, clientId) {
  await request.delete(`/api/v1/debug/appointments/client/${clientId}/future`);
}

// Polls GET /notifications until matcher returns truthy or timeout expires.
// Used only for booking-confirmation, which fires asynchronously.
async function pollForNotification(request, token, matcher, { timeout = 5000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const notifications = await getNotifications(request, token);
    const found = notifications.find(matcher);
    if (found) return found;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

const DEFAULT_PREFS = {
  emailAppointmentRemind: true,
  emailBookingConfirm:    true,
  smsAppointmentRemind:   false,
  smsBookingConfirm:      false,
};

// ── Setup / teardown ──────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  serviceId = await getServiceId(request);

  // Give Sarah availability on the notification test date (for the booking confirmation test)
  await setAvailability(request, SARAH_ID, SARAH_TOKEN, [
    { date: NOTIF_DATE, startTime: '09:00', endTime: '17:00' },
  ]);

  // Cancel any lingering future appointments for client1 (prevents followup suppression)
  await cancelClientFutureAppts(request, CLIENT_ID);

  // Reset client1's notification preferences to known defaults
  await setPreferences(request, CLIENT_TOKEN, DEFAULT_PREFS);
});

test.afterAll(async ({ request }) => {
  for (const id of createdApptIds) {
    await cancelApptById(request, id);
  }
  await deleteAvailability(request, SARAH_ID, SARAH_TOKEN, [NOTIF_DATE]);
  await setPreferences(request, CLIENT_TOKEN, DEFAULT_PREFS);
});

// ── 1. Notification Preferences — UI ─────────────────────────────────────────

test('Settings → Notifications shows email toggles on and SMS toggles off by default', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.client);
  await page.goto('/settings');
  await page.waitForSelector('.settings-page');
  await page.click('button.settings-nav__link:has-text("Notifications")');
  await page.waitForSelector('.notif-prefs');

  await expect(page.locator('#email-confirm')).toBeChecked();
  await expect(page.locator('#email-remind')).toBeChecked();
  await expect(page.locator('#sms-confirm')).not.toBeChecked();
  await expect(page.locator('#sms-remind')).not.toBeChecked();
});

test('Settings → Notifications can toggle off a preference and persist it', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.client);
  await page.goto('/settings');
  await page.waitForSelector('.settings-page');
  await page.click('button.settings-nav__link:has-text("Notifications")');
  await page.waitForSelector('.notif-prefs');

  // Toggle off booking confirmations
  await expect(page.locator('#email-confirm')).toBeChecked();
  await page.locator('label[for="email-confirm"]').click();
  await expect(page.locator('#email-confirm')).not.toBeChecked();

  await page.click('button.btn--primary:has-text("Save Preferences")');
  await expect(page.locator('.settings-success')).toHaveText('Preferences saved.');

  // Reload and verify persistence
  await page.reload();
  await page.click('button.settings-nav__link:has-text("Notifications")');
  await page.waitForSelector('.notif-prefs');
  await expect(page.locator('#email-confirm')).not.toBeChecked();
});

test('Settings → Notifications can re-enable a preference', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.client);
  await page.goto('/settings');
  await page.waitForSelector('.settings-page');
  await page.click('button.settings-nav__link:has-text("Notifications")');
  await page.waitForSelector('.notif-prefs');

  await expect(page.locator('#email-confirm')).not.toBeChecked();
  await page.locator('label[for="email-confirm"]').click();
  await expect(page.locator('#email-confirm')).toBeChecked();

  await page.click('button.btn--primary:has-text("Save Preferences")');
  await expect(page.locator('.settings-success')).toHaveText('Preferences saved.');
});

// ── 2. Notification Preferences — API ────────────────────────────────────────

test('GET /notifications/preferences returns current preferences', async ({ request }) => {
  const prefs = await getPreferences(request, CLIENT_TOKEN);

  expect(prefs.email_appointment_remind).toBe(true);
  expect(prefs.email_booking_confirm).toBe(true);
  expect(prefs.sms_appointment_remind).toBe(false);
  expect(prefs.sms_booking_confirm).toBe(false);
});

test('PUT /notifications/preferences updates and returns new values', async ({ request }) => {
  const result = await setPreferences(request, CLIENT_TOKEN, {
    emailAppointmentRemind: false,
    emailBookingConfirm:    true,
    smsAppointmentRemind:   true,
    smsBookingConfirm:      false,
  });

  expect(result.success).toBe(true);
  expect(result.data.preferences.email_appointment_remind).toBe(false);
  expect(result.data.preferences.sms_appointment_remind).toBe(true);

  // Verify GET reflects the change
  const prefs = await getPreferences(request, CLIENT_TOKEN);
  expect(prefs.email_appointment_remind).toBe(false);

  // Reset to defaults
  await setPreferences(request, CLIENT_TOKEN, DEFAULT_PREFS);
});

test('GET /notifications/preferences returns 401 when unauthenticated', async ({ request }) => {
  const res = await request.get('/api/v1/notifications/preferences');
  expect(res.status()).toBe(401);
});

test('PUT /notifications/preferences returns 401 when unauthenticated', async ({ request }) => {
  const res = await request.put('/api/v1/notifications/preferences', { data: DEFAULT_PREFS });
  expect(res.status()).toBe(401);
});

test('PUT /notifications/preferences returns 422 when fields are missing', async ({ request }) => {
  const res = await request.put('/api/v1/notifications/preferences', {
    data:    { emailAppointmentRemind: true },
    headers: { Authorization: `Bearer ${CLIENT_TOKEN}` },
  });
  expect(res.status()).toBe(422);
});

// ── 3. Booking Confirmation Notification ──────────────────────────────────────

test('booking confirmation email is logged for therapist when a guest books', async ({ request }) => {
  const res = await request.post('/api/v1/appointments', {
    data: {
      therapistId:     SARAH_ID,
      serviceId,
      scheduledAt:     `${NOTIF_DATE}T15:00:00.000Z`,
      guestName:       'Notification Test Guest',
      guestEmail:      'notif-test@example.invalid',
      waiverSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  createdApptIds.push(body.data.appointment.id);

  // Therapist notification is sent async — poll for it
  const notification = await pollForNotification(
    request,
    SARAH_TOKEN,
    n => n.channel === 'email' && n.subject?.includes('New booking'),
  );

  expect(notification).not.toBeNull();
  expect(notification.status).toBe('sent');
  expect(notification.channel).toBe('email');
});

test('booking confirmation email is logged for client when email_booking_confirm is enabled', async ({ request }) => {
  // Create a confirmed appointment for client1 via the backdated endpoint
  const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'confirmed',
  });
  createdApptIds.push(appt.id);

  // Trigger booking confirmation via the debug endpoint (bypasses the booking UI / Stripe)
  const res = await request.post(`/api/v1/debug/send-booking-confirmation/${appt.id}`);
  expect(res.ok()).toBe(true);

  const notifications   = await getNotifications(request, CLIENT_TOKEN);
  const confirmation    = notifications.find(n =>
    n.channel === 'email' && n.subject?.includes('appointment is confirmed')
  );
  expect(confirmation).toBeDefined();
  expect(confirmation.status).toBe('sent');
});

test('booking confirmation email is suppressed when email_booking_confirm is disabled', async ({ request }) => {
  await setPreferences(request, CLIENT_TOKEN, { ...DEFAULT_PREFS, emailBookingConfirm: false });

  const scheduledAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'confirmed',
  });
  createdApptIds.push(appt.id);

  const before = await getNotifications(request, CLIENT_TOKEN);
  const countBefore = before.filter(n => n.subject?.includes('appointment is confirmed')).length;

  await request.post(`/api/v1/debug/send-booking-confirmation/${appt.id}`);

  const after = await getNotifications(request, CLIENT_TOKEN);
  // No new confirmation logged for client (preference is off)
  expect(after.filter(n => n.subject?.includes('appointment is confirmed')).length).toBe(countBefore);

  await setPreferences(request, CLIENT_TOKEN, DEFAULT_PREFS);
});

// ── 4. Cron Worker — 24h Appointment Reminder ────────────────────────────────

test('24h reminder email is sent to client and therapist for a confirmed appointment', async ({ request }) => {
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'confirmed',
  });
  createdApptIds.push(appt.id);

  await triggerNotifications(request);

  // Client receives a reminder
  const clientNotifs   = await getNotifications(request, CLIENT_TOKEN);
  const clientReminder = clientNotifs.find(n =>
    n.channel === 'email' && n.subject === 'Appointment reminder — Atlas Bodywork'
  );
  expect(clientReminder).toBeDefined();
  expect(clientReminder.status).toBe('sent');

  // Therapist also receives a reminder
  const sarahNotifs       = await getNotifications(request, SARAH_TOKEN);
  const therapistReminder = sarahNotifs.find(n =>
    n.channel === 'email' && n.subject?.includes('Reminder: appointment tomorrow')
  );
  expect(therapistReminder).toBeDefined();
  expect(therapistReminder.status).toBe('sent');
});

test('24h reminder is not sent twice (reminded_at prevents duplicates)', async ({ request }) => {
  const clientBefore = await getNotifications(request, CLIENT_TOKEN);
  const countBefore  = clientBefore.filter(n => n.subject === 'Appointment reminder — Atlas Bodywork').length;

  // Trigger again — the appointment's reminded_at is already set
  await triggerNotifications(request);

  const clientAfter = await getNotifications(request, CLIENT_TOKEN);
  const countAfter  = clientAfter.filter(n => n.subject === 'Appointment reminder — Atlas Bodywork').length;

  expect(countAfter).toBe(countBefore);
});

// ── 5. Cron Worker — Reminder Respects Preferences ───────────────────────────

test('24h reminder is suppressed for client when email_appointment_remind is disabled', async ({ request }) => {
  await setPreferences(request, CLIENT_TOKEN, { ...DEFAULT_PREFS, emailAppointmentRemind: false });

  // Use a slightly different offset so this appointment is distinct from the one above
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'confirmed',
  });
  createdApptIds.push(appt.id);

  const clientBefore = await getNotifications(request, CLIENT_TOKEN);
  const countBefore  = clientBefore.filter(n => n.subject === 'Appointment reminder — Atlas Bodywork').length;

  await triggerNotifications(request);

  const clientAfter = await getNotifications(request, CLIENT_TOKEN);
  const countAfter  = clientAfter.filter(n => n.subject === 'Appointment reminder — Atlas Bodywork').length;

  // Client's reminder count is unchanged because the preference is disabled
  expect(countAfter).toBe(countBefore);

  await setPreferences(request, CLIENT_TOKEN, DEFAULT_PREFS);
});

// ── 6. Cron Worker — Feedback Request ────────────────────────────────────────

test('feedback request email is sent to client 24h after a completed appointment', async ({ request }) => {
  const scheduledAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'completed',
  });
  createdApptIds.push(appt.id);

  await triggerNotifications(request);

  const notifications = await getNotifications(request, CLIENT_TOKEN);
  const feedback      = notifications.find(n =>
    n.channel === 'email' && n.subject === 'How was your Atlas Bodywork visit?'
  );
  expect(feedback).toBeDefined();
  expect(feedback.status).toBe('sent');
});

test('feedback request is not sent twice (feedback_sent_at prevents duplicates)', async ({ request }) => {
  const before = await getNotifications(request, CLIENT_TOKEN);
  const count  = before.filter(n => n.subject === 'How was your Atlas Bodywork visit?').length;

  await triggerNotifications(request);

  const after = await getNotifications(request, CLIENT_TOKEN);
  expect(after.filter(n => n.subject === 'How was your Atlas Bodywork visit?').length).toBe(count);
});

// ── 7. Cron Worker — Week Followup ───────────────────────────────────────────

test('week followup email is sent 7 days after a completed appointment', async ({ request }) => {
  await cancelClientFutureAppts(request, CLIENT_ID);

  const scheduledAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'completed',
  });
  createdApptIds.push(appt.id);

  await triggerNotifications(request);

  const notifications  = await getNotifications(request, CLIENT_TOKEN);
  const weekFollowup   = notifications.find(n =>
    n.channel === 'email' && n.subject?.includes('Time for another session')
  );
  expect(weekFollowup).toBeDefined();
  expect(weekFollowup.status).toBe('sent');
});

test('week followup is skipped when the client has a future confirmed appointment', async ({ request }) => {
  // Create a future confirmed appointment to suppress the followup
  const futureAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const futureAppt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt: futureAt,
    status:      'confirmed',
  });
  createdApptIds.push(futureAppt.id);

  // Create a completed appointment in the 7-day window (offset slightly to be distinct)
  const scheduledAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'completed',
  });
  createdApptIds.push(appt.id);

  const before = await getNotifications(request, CLIENT_TOKEN);
  const count  = before.filter(n => n.subject?.includes('Time for another session')).length;

  await triggerNotifications(request);

  const after = await getNotifications(request, CLIENT_TOKEN);
  expect(after.filter(n => n.subject?.includes('Time for another session')).length).toBe(count);
});

// ── 8. Cron Worker — Month Followup ──────────────────────────────────────────

test('month followup email is sent 30 days after a completed appointment', async ({ request }) => {
  await cancelClientFutureAppts(request, CLIENT_ID);

  const scheduledAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'completed',
  });
  createdApptIds.push(appt.id);

  await triggerNotifications(request);

  const notifications = await getNotifications(request, CLIENT_TOKEN);
  const monthFollowup = notifications.find(n =>
    n.channel === 'email' && n.subject?.includes("It's been a month")
  );
  expect(monthFollowup).toBeDefined();
  expect(monthFollowup.status).toBe('sent');
});

test('month followup is skipped when the client has a future confirmed appointment', async ({ request }) => {
  // Create a future confirmed appointment to suppress the followup
  const futureAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const futureAppt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt: futureAt,
    status:      'confirmed',
  });
  createdApptIds.push(futureAppt.id);

  // Completed appointment in the 30-day window (offset slightly to be distinct)
  const scheduledAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000).toISOString();
  const appt = await createBackdatedAppt(request, {
    therapistId: SARAH_ID,
    serviceId,
    clientId:    CLIENT_ID,
    scheduledAt,
    status:      'completed',
  });
  createdApptIds.push(appt.id);

  const before = await getNotifications(request, CLIENT_TOKEN);
  const count  = before.filter(n => n.subject?.includes("It's been a month")).length;

  await triggerNotifications(request);

  const after = await getNotifications(request, CLIENT_TOKEN);
  expect(after.filter(n => n.subject?.includes("It's been a month")).length).toBe(count);
});

// ── 9. Notification History API ───────────────────────────────────────────────

test('GET /notifications returns 401 when unauthenticated', async ({ request }) => {
  const res = await request.get('/api/v1/notifications');
  expect(res.status()).toBe(401);
});

test('GET /notifications returns an array of notification records with expected fields', async ({ request }) => {
  const notifications = await getNotifications(request, CLIENT_TOKEN);
  expect(Array.isArray(notifications)).toBe(true);

  // All notifications created by this suite have been logged by now
  expect(notifications.length).toBeGreaterThan(0);

  const n = notifications[0];
  expect(n).toHaveProperty('id');
  expect(n).toHaveProperty('channel');
  expect(n).toHaveProperty('status');
  expect(n).toHaveProperty('created_at');
  expect(['email', 'sms']).toContain(n.channel);
  expect(['sent', 'failed', 'pending']).toContain(n.status);
});
