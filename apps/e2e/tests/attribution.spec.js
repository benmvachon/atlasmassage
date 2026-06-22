/**
 * E2E tests for marketing attribution (UTM source tagging).
 *
 * Covers the full path: capturing UTM params from the landing URL into browser
 * storage, carrying first/last-touch through a real guest booking, and surfacing
 * the result on the owner marketing dashboard. Runs against the real dev stack.
 */
import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, getAuthState, loginInBrowser,
  setAvailability, deleteAvailability, getServiceId,
  mockStripeDisabled, mockValidateAddress, drawSignature, debugHeaders,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const { owner, sarah, client } = getAuthState();
const SARAH_ID = sarah.userId;
const SARAH_TOKEN = sarah.token;
const OWNER_TOKEN = owner.token;
const CLIENT_TOKEN = client.token;
const CLIENT_ID = client.userId;

// Dedicated future date (Nov 2030 — unused by other suites) for the real booking.
const BOOK_DATE = '2030-11-04'; // Monday

// ── 1. URL capture: first-touch is sticky, last-touch follows the latest link ──

test.describe('UTM capture into browser storage', () => {
  test('records first-touch once and refreshes last-touch on each tagged visit', async ({ page }) => {
    // First tagged visit — discovery channel.
    await page.goto('/booking?year=2030&month=11&utm_source=e2e_newsletter&utm_medium=email&utm_campaign=e2e_spring');
    await page.waitForSelector('.avail-calendar');

    const afterFirst = await page.evaluate(() => ({
      first: JSON.parse(localStorage.getItem('atlas_first_touch')),
      last: JSON.parse(sessionStorage.getItem('atlas_last_touch')),
    }));
    expect(afterFirst.first).toMatchObject({ source: 'e2e_newsletter', medium: 'email', campaign: 'e2e_spring' });
    expect(afterFirst.last).toMatchObject({ source: 'e2e_newsletter' });

    // Second tagged visit in the same tab — paid channel.
    await page.goto('/booking?year=2030&month=11&utm_source=e2e_paid&utm_medium=cpc&utm_campaign=e2e_summer');
    await page.waitForSelector('.avail-calendar');

    const afterSecond = await page.evaluate(() => ({
      first: JSON.parse(localStorage.getItem('atlas_first_touch')),
      last: JSON.parse(sessionStorage.getItem('atlas_last_touch')),
    }));
    // First-touch unchanged (still the original discovery channel)...
    expect(afterSecond.first).toMatchObject({ source: 'e2e_newsletter' });
    // ...last-touch updated to the most recent link.
    expect(afterSecond.last).toMatchObject({ source: 'e2e_paid', medium: 'cpc', campaign: 'e2e_summer' });
  });

  test('leaves storage untouched when no UTM params are present', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    const stored = await page.evaluate(() => ({
      first: localStorage.getItem('atlas_first_touch'),
      last: sessionStorage.getItem('atlas_last_touch'),
    }));
    expect(stored.first).toBeNull();
    expect(stored.last).toBeNull();
  });
});

// ── 2. End-to-end: captured UTM is persisted (and sanitized) on the booking ────

test.describe('Attribution flows through a real guest booking', () => {
  test.beforeAll(async ({ request }) => {
    await setAvailability(request, SARAH_ID, SARAH_TOKEN, [
      { date: BOOK_DATE, startTime: '09:00', endTime: '17:00' },
    ]);
  });

  test.afterAll(async ({ request }) => {
    await deleteAvailability(request, SARAH_ID, SARAH_TOKEN, [BOOK_DATE]);
  });

  test.beforeEach(async ({ page }) => {
    await mockValidateAddress(page);
    await mockStripeDisabled(page);
  });

  test('a UTM-tagged landing carries source/medium/campaign onto the appointment, sanitized', async ({ page, request }) => {
    // Land via a messy-cased, whitespace-padded UTM link to also exercise sanitization.
    await page.goto(`/booking?year=2030&month=11&utm_source=E2E_Google%20&utm_medium=CPC&utm_campaign=Summer_2030`);
    await page.waitForSelector('.avail-calendar');

    // Open the booking modal on the seeded date.
    await page.click(`button[aria-label*="${BOOK_DATE}"][aria-label*="available"]`);
    await page.locator('button.slot-btn').first().click();
    await page.waitForSelector('[role="dialog"][aria-labelledby="booking-modal-title"]');
    await page.click('button:has-text("Continue as guest")');
    await page.waitForSelector('#bm-name');

    // Contact step.
    await page.fill('#bm-name', 'Attribution E2E');
    await page.fill('#bm-email', 'attribution-e2e@test.invalid');
    await page.fill('#bm-addr1', '123 Test St');
    await page.fill('#bm-city', 'Test City');
    await page.fill('#bm-state', 'CA');
    await page.fill('#bm-zip', '90210');
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    // Health step (all optional).
    await page.waitForSelector('#bm-medications');
    await page.locator('.booking-modal form').evaluate(f => f.requestSubmit());

    // Consent step — sign + agree.
    await page.waitForSelector('.waiver-sig__canvas');
    await drawSignature(page);
    for (const cb of await page.locator('.waiver-agree__checkbox').all()) {
      await cb.evaluate(el => el.click());
    }
    await page.locator('.avail-modal__actions .btn--primary').click();
    await page.waitForSelector('.booking-divider'); // payment step

    // Submit the real booking and capture the created appointment id.
    const respPromise = page.waitForResponse(r =>
      r.url().includes('/api/v1/appointments') && r.request().method() === 'POST'
    );
    await page.locator('button:has-text("Book Appointment")').click();
    const resp = await respPromise;
    const body = await resp.json();
    const apptId = body.data?.appointment?.id;
    expect(apptId).toBeTruthy();

    await expect(page.locator('.booking-modal__success-title')).toContainText('Booking Confirmed');

    // Read the stored attribution back: source/medium lowercased & trimmed, campaign preserved.
    const attrRes = await request.get(`/api/v1/debug/appointments/${apptId}/attribution`, { headers: debugHeaders() });
    const attr = (await attrRes.json()).data.attribution;
    expect(attr.first_utm_source).toBe('e2e_google');
    expect(attr.first_utm_medium).toBe('cpc');
    expect(attr.first_utm_campaign).toBe('Summer_2030');
    // Single-visit booking: last-touch falls back to first-touch.
    expect(attr.last_utm_source).toBe('e2e_google');

    // Clean up the appointment.
    await request.delete(`/api/v1/debug/appointments/${apptId}`, { headers: debugHeaders() });
  });
});

// ── 2b. End-to-end: attribution flows through a logged-in client's booking ─────

test.describe('Attribution flows through an authenticated booking', () => {
  // Dedicated Monday, distinct from the guest-booking date above.
  const AUTH_BOOK_DATE = '2030-11-11';

  test.beforeAll(async ({ request }) => {
    await setAvailability(request, SARAH_ID, SARAH_TOKEN, [
      { date: AUTH_BOOK_DATE, startTime: '09:00', endTime: '17:00' },
    ]);
  });

  test.afterAll(async ({ request }) => {
    await deleteAvailability(request, SARAH_ID, SARAH_TOKEN, [AUTH_BOOK_DATE]);
  });

  test.beforeEach(async ({ page }) => {
    await mockValidateAddress(page);
    await mockStripeDisabled(page);
  });

  test('a logged-in client carries first/last-touch through to the appointment', async ({ page, request }) => {
    // Authenticate first so the booking is attributed to the real client account.
    await loginInBrowser(page, ACCOUNTS.client);

    // First tagged visit — discovery channel. First-touch is written once here.
    await page.goto('/booking?year=2030&month=11&utm_source=e2e_auth_first&utm_medium=email&utm_campaign=e2e_auth');
    await page.waitForSelector('.avail-calendar');

    // Second tagged visit — the converting channel. Last-touch is overwritten,
    // first-touch stays put.
    await page.goto('/booking?year=2030&month=11&utm_source=e2e_auth_last&utm_medium=cpc&utm_campaign=e2e_auth');
    // Wait for the session to be restored from the refresh cookie before booking.
    await page.waitForSelector('.header__signout', { timeout: 10000 });
    await page.waitForSelector('.avail-calendar');

    // Open the booking modal on the seeded date.
    await page.click(`button[aria-label*="${AUTH_BOOK_DATE}"][aria-label*="available"]`);
    await page.locator('button.slot-btn').first().click();
    await page.waitForSelector('[role="dialog"][aria-labelledby="booking-modal-title"]');

    // A returning client (seeded health record + consent) skips the guest gate and
    // the contact/health/consent steps, landing directly on the payment step.
    await page.waitForSelector('#bm-service');
    expect(await page.locator('button:has-text("Continue as guest")').count()).toBe(0);
    expect(await page.locator('#bm-name').count()).toBe(0);

    // Submit the real booking and capture the created appointment id.
    const respPromise = page.waitForResponse(r =>
      r.url().includes('/api/v1/appointments') && r.request().method() === 'POST'
    );
    await page.locator('button:has-text("Book Appointment")').click();
    const resp = await respPromise;
    const body = await resp.json();
    const apptId = body.data?.appointment?.id;
    expect(apptId).toBeTruthy();

    await expect(page.locator('.booking-modal__success-title')).toContainText('Booking Confirmed');

    // The appointment carries first-touch from the discovery visit and last-touch
    // from the converting visit — proving capture survives login and a returning
    // client's abbreviated wizard.
    const attrRes = await request.get(`/api/v1/debug/appointments/${apptId}/attribution`, { headers: debugHeaders() });
    const attr = (await attrRes.json()).data.attribution;
    expect(attr.first_utm_source).toBe('e2e_auth_first');
    expect(attr.first_utm_medium).toBe('email');
    expect(attr.last_utm_source).toBe('e2e_auth_last');
    expect(attr.last_utm_medium).toBe('cpc');

    // Clean up the appointment.
    await request.delete(`/api/v1/debug/appointments/${apptId}`, { headers: debugHeaders() });
  });
});

// ── 3 & 4. Owner marketing dashboard + authorization ───────────────────────────

test.describe('Owner marketing-sources dashboard', () => {
  const createdApptIds = [];
  const FIRST_SRC = 'e2e_discovery';
  const LAST_SRC = 'e2e_conversion';

  test.beforeAll(async ({ request }) => {
    const serviceId = await getServiceId(request);
    // Two completed appointments dated within the dashboard's default 30-day window,
    // with a first-touch source distinct from the last-touch source so the toggle
    // visibly changes the breakdown.
    const dates = [
      new Date(Date.now() - 5 * 86400000).toISOString(),
      new Date(Date.now() - 12 * 86400000).toISOString(),
    ];
    for (const scheduledAt of dates) {
      const res = await request.post('/api/v1/debug/appointments/backdated', {
        data: {
          therapistId: SARAH_ID,
          serviceId,
          clientId: CLIENT_ID,
          scheduledAt,
          status: 'completed',
          firstUtmSource: FIRST_SRC, firstUtmMedium: 'organic', firstUtmCampaign: 'e2e_attr',
          lastUtmSource: LAST_SRC, lastUtmMedium: 'cpc', lastUtmCampaign: 'e2e_attr',
        },
        headers: debugHeaders(),
      });
      const appt = (await res.json()).data.appointment;
      createdApptIds.push(appt.id);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdApptIds) {
      await request.delete(`/api/v1/debug/appointments/${id}`, { headers: debugHeaders() });
    }
  });

  test('GET /admin/marketing-sources aggregates by first- and last-touch source', async ({ request }) => {
    const first = await request.get('/api/v1/admin/marketing-sources?touch=first', {
      headers: { Authorization: `Bearer ${OWNER_TOKEN}` },
    });
    expect(first.ok()).toBeTruthy();
    const firstData = (await first.json()).data;
    expect(firstData.touch).toBe('first');
    expect(firstData.bySource.some(r => r.source === FIRST_SRC)).toBe(true);

    const last = await request.get('/api/v1/admin/marketing-sources?touch=last', {
      headers: { Authorization: `Bearer ${OWNER_TOKEN}` },
    });
    const lastData = (await last.json()).data;
    expect(lastData.touch).toBe('last');
    expect(lastData.bySource.some(r => r.source === LAST_SRC)).toBe(true);
  });

  test('non-owner cannot access the marketing-sources endpoint', async ({ request }) => {
    const res = await request.get('/api/v1/admin/marketing-sources', {
      headers: { Authorization: `Bearer ${CLIENT_TOKEN}` },
    });
    expect(res.status()).toBe(403);
  });

  test('dashboard page renders the breakdown and the first/last-touch toggle switches sources', async ({ page }) => {
    await loginInBrowser(page, ACCOUNTS.owner);
    await page.goto('/owner/sources');

    // Default view is first-touch.
    await page.waitForSelector('.owner-table');
    await expect(page.locator('.owner-table')).toContainText(FIRST_SRC);

    // Toggle to last-touch — the breakdown re-fetches and shows the converting source.
    await page.locator('button:has-text("Last-touch")').click();
    await expect(page.locator('.owner-table')).toContainText(LAST_SRC);
  });
});

// ── 5. Owner marketing-analytics dashboard (time-series + infinite-scroll list) ──

test.describe('Owner marketing-analytics dashboard', () => {
  const createdApptIds = [];
  const SRC_A = 'e2e_analytics_a';
  const SRC_B = 'e2e_analytics_b';
  const ownerAuth = { headers: { Authorization: `Bearer ${OWNER_TOKEN}` } };

  test.beforeAll(async ({ request }) => {
    const serviceId = await getServiceId(request);
    // A handful of completed, attributed appointments within the default 30-day window,
    // split across two sources so the source filter has something to narrow.
    const mk = async (daysAgo, source) => {
      const res = await request.post('/api/v1/debug/appointments/backdated', {
        data: {
          therapistId: SARAH_ID, serviceId, clientId: CLIENT_ID,
          scheduledAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
          status: 'completed',
          firstUtmSource: source, firstUtmMedium: 'cpc', firstUtmCampaign: 'e2e_analytics',
          lastUtmSource: source, lastUtmMedium: 'cpc', lastUtmCampaign: 'e2e_analytics',
        },
        headers: debugHeaders(),
      });
      createdApptIds.push((await res.json()).data.appointment.id);
    };
    await mk(3, SRC_A);
    await mk(6, SRC_A);
    await mk(9, SRC_B);
    await mk(12, SRC_B);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdApptIds) {
      await request.delete(`/api/v1/debug/appointments/${id}`, { headers: debugHeaders() });
    }
  });

  test('timeseries endpoint buckets attributed bookings by date and source', async ({ request }) => {
    const res = await request.get('/api/v1/admin/attribution/timeseries?touch=first', ownerAuth);
    expect(res.ok()).toBeTruthy();
    const { series } = (await res.json()).data;
    expect(series.some(r => r.source === SRC_A)).toBe(true);
    expect(series.some(r => r.source === SRC_B)).toBe(true);
  });

  test('appointments endpoint keyset-paginates with an opaque cursor', async ({ request }) => {
    const first = await request.get('/api/v1/admin/attribution/appointments?limit=2', ownerAuth);
    const firstData = (await first.json()).data;
    expect(firstData.appointments).toHaveLength(2);
    expect(firstData.nextCursor).toBeTruthy();

    const second = await request.get(
      `/api/v1/admin/attribution/appointments?limit=2&cursor=${encodeURIComponent(firstData.nextCursor)}`,
      ownerAuth
    );
    const secondData = (await second.json()).data;
    // Newest-first ordering with no overlap between consecutive pages.
    const firstIds = firstData.appointments.map(a => a.id);
    expect(secondData.appointments.every(a => !firstIds.includes(a.id))).toBe(true);
  });

  test('source filter narrows the appointment list', async ({ request }) => {
    const res = await request.get(`/api/v1/admin/attribution/appointments?source=${SRC_A}&limit=50`, ownerAuth);
    const { appointments } = (await res.json()).data;
    expect(appointments.length).toBeGreaterThanOrEqual(2);
    expect(appointments.every(a => a.first_utm_source === SRC_A)).toBe(true);
  });

  test('non-owner cannot access the attribution endpoints', async ({ request }) => {
    const res = await request.get('/api/v1/admin/attribution/appointments', {
      headers: { Authorization: `Bearer ${CLIENT_TOKEN}` },
    });
    expect(res.status()).toBe(403);
  });

  test('analytics page renders the chart and a filterable appointment list', async ({ page }) => {
    await loginInBrowser(page, ACCOUNTS.owner);
    await page.goto('/owner/analytics');

    // Time-series visualization renders.
    await page.waitForSelector('.recharts-surface');

    // Infinite-scroll list populates and shows both seeded sources.
    await page.waitForSelector('.owner-table tbody tr');
    await expect(page.locator('.owner-table')).toContainText(SRC_A);
    await expect(page.locator('.owner-table')).toContainText(SRC_B);

    // Filtering by source B reloads the list to just that channel.
    await page.locator('.mkt-filters select').first().selectOption(SRC_B);
    await expect(page.locator('.owner-table')).toContainText(SRC_B);
    await expect(page.locator('.owner-table')).not.toContainText(SRC_A);
  });
});
