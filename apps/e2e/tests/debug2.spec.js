import { test, expect } from '@playwright/test';
import { getAuthState, loginInBrowser, ACCOUNTS } from './helpers.js';

test('debug: verify save button in availability modal', async ({ page }) => {
  const { sarah } = getAuthState();
  console.log('sarahUserId:', sarah.userId);

  await loginInBrowser(page, ACCOUNTS.sarah);
  await page.goto('/therapist/schedule');
  await page.waitForSelector('.avail-calendar');

  // Navigate to next month
  await page.click('button[aria-label="Next month"]');
  await page.click('button[aria-label="Next month"]');
  const header = await page.locator('.avail-calendar__month').innerText();
  console.log('calendar month:', header);

  // Capture all outgoing API requests
  page.on('request', req => {
    if (req.url().includes('/api/v1/availability')) {
      console.log('REQ:', req.method(), req.url());
    }
  });

  // Click first available non-past non-disabled cell
  const cell = page.locator('button.avail-calendar__cell:not([disabled]):not(.avail-calendar__cell--pad)').first();
  const label = await cell.getAttribute('aria-label');
  console.log('clicking cell:', label);
  await cell.click();

  await expect(page.locator('.schedule-action-bar')).toBeVisible();
  console.log('action bar visible');
  await page.click('button:has-text("Set Availability")');
  await page.waitForSelector('[role="dialog"]');
  console.log('dialog opened');

  const saveBtn = page.locator('[role="dialog"] .avail-modal__actions button.btn--primary');
  const count = await saveBtn.count();
  const text = count > 0 ? await saveBtn.innerText() : 'NOT FOUND';
  const disabled = count > 0 ? await saveBtn.isDisabled() : 'N/A';
  console.log(`save button: count=${count}, text="${text}", disabled=${disabled}`);

  if (count > 0) {
    await page.click('[role="dialog"] .avail-modal__actions button.btn--primary');
    console.log('clicked save button');
  }

  await page.waitForTimeout(3000);
  const dialogStillOpen = await page.locator('[role="dialog"]').isVisible();
  const errorText = await page.locator('[role="dialog"] .avail-modal__error').innerText().catch(() => '');
  console.log('dialog still open:', dialogStillOpen, '| error:', errorText);

  expect(true).toBe(true);
});
