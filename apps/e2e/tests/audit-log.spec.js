import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginInBrowser } from './helpers.js';

// The audit log is the detection layer for PHI access — if the page silently
// fails to render, the trail exists but nobody is reading it.

test('owner can open the audit log from the sidebar', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.owner);
  await page.goto('/owner/dashboard');

  await page.getByRole('link', { name: 'Audit Log' }).click();

  await expect(page).toHaveURL(/\/owner\/audit-log/);
  await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
});

test('audit log renders entries or an explicit empty state', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.owner);
  await page.goto('/owner/audit-log');

  await expect(page.locator('.owner-loading')).toHaveCount(0);
  await expect(page.locator('.owner-error')).toHaveCount(0);

  const table = page.locator('.owner-table');
  const empty = page.locator('.owner-empty');
  await expect(table.or(empty).first()).toBeVisible();
});

test('filtering by record type narrows the result set', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.owner);
  await page.goto('/owner/audit-log');
  await expect(page.locator('.owner-loading')).toHaveCount(0);

  // The filter triggers a refetch; asserting before it lands reads the stale
  // (or still-loading) table.
  await Promise.all([
    page.waitForResponse(r => r.url().includes('entity=soap_notes') && r.status() === 200),
    page.getByLabel('Record type').selectOption('soap_notes'),
  ]);
  await expect(page.locator('.owner-loading')).toHaveCount(0);

  // Every visible row is a SOAP notes entry, or the empty state is shown.
  const rows = page.locator('.owner-table tbody tr');
  const count = await rows.count();
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('SOAP notes');
    }
  } else {
    await expect(page.locator('.owner-empty')).toBeVisible();
  }

  // Clearing restores the unfiltered view.
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByLabel('Record type')).toHaveValue('');
});

test('audit log is not reachable by a therapist', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/owner/audit-log');

  await expect(page.getByRole('heading', { name: 'Audit Log' })).toHaveCount(0);
});
