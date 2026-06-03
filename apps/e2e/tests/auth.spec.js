/**
 * E2E tests for authentication flows.
 *
 * Covers: login, logout, signup, session persistence, protected-route guards,
 * forgot-password, and reset-password (including the full token flow).
 *
 * Uses serial mode because some tests modify shared state (client1's password)
 * and the afterAll must restore it before the next run.
 */
import { test, expect } from '@playwright/test';
import { ACCOUNTS, getAuthState, loginInBrowser } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const { client } = getAuthState();

// Unique email for the signup happy-path test — generated once per run.
const SIGNUP_EMAIL = `e2e-${Date.now()}@example.com`;
const SIGNUP_PASSWORD = 'TestE2EPass1';

// Track whether client1's password was changed so afterAll can restore it.
let clientPasswordChanged = false;

test.afterAll(async ({ request }) => {
  if (!clientPasswordChanged) return;
  const res = await request.post('/api/v1/debug/issue-reset-token', {
    data: { email: ACCOUNTS.client.email },
  });
  const { data: { token } } = await res.json();
  await request.post('/api/v1/auth/reset-password', {
    data: { token, password: ACCOUNTS.client.password },
  });
  clientPasswordChanged = false;
});

// ── Login page ────────────────────────────────────────────────────────────────

test('login page renders email, password fields and sign-in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
});

test('login - empty form shows inline field errors', async ({ page }) => {
  await page.goto('/login');
  await page.click('button[type="submit"]');
  await expect(page.locator('.form-field__error').first()).toBeVisible();
});

test('login - wrong password shows API error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', ACCOUNTS.client.email);
  await page.fill('#password', 'wrong-password-xyz');
  await page.click('button[type="submit"]');
  await expect(page.locator('.auth-card__api-error')).toBeVisible();
});

test('login - client credentials redirect to home', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', ACCOUNTS.client.email);
  await page.fill('#password', ACCOUNTS.client.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  // Header should reflect logged-in state (sign-out button visible)
  await expect(page.locator('.header__signout')).toBeVisible();
});

test('login - therapist credentials redirect to /therapist/bookings', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', ACCOUNTS.sarah.email);
  await page.fill('#password', ACCOUNTS.sarah.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/therapist/bookings');
});

test('login - owner credentials redirect to /owner/dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', ACCOUNTS.owner.email);
  await page.fill('#password', ACCOUNTS.owner.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/owner/dashboard');
});

test('login - redirect param is honored after successful sign-in', async ({ page }) => {
  // Navigate to a protected page while logged out
  await page.goto('/settings');
  // Should land on login with a from-state or redirect in the URL/state
  await page.waitForURL(/\/login/);
  // Fill and sign in as client
  await page.fill('#email', ACCOUNTS.client.email);
  await page.fill('#password', ACCOUNTS.client.password);
  await page.click('button[type="submit"]');
  // Should end up at /settings, not at /
  await page.waitForURL('/settings');
});

test('login - "Forgot password?" link navigates to /forgot-password', async ({ page }) => {
  await page.goto('/login');
  await page.click('a[href="/forgot-password"]');
  await page.waitForURL('/forgot-password');
});

test('login - "Create one" link navigates to /signup', async ({ page }) => {
  await page.goto('/login');
  await page.click('a[href="/signup"]');
  await page.waitForURL('/signup');
});

// ── Session + logout ──────────────────────────────────────────────────────────

test('session persists across a page reload', async ({ page }) => {
  // Log in via the browser so the HttpOnly cookie is set
  await loginInBrowser(page, ACCOUNTS.client);
  await page.goto('/');
  await page.waitForSelector('.header__signout');

  // Reload — AuthContext will call /auth/refresh and restore the session
  await page.reload();

  // Sign-out button should be visible after session is restored
  await expect(page.locator('.header__signout')).toBeVisible();
});

test('logout clears the session and blocks access to protected pages', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.client);
  await page.goto('/settings');
  await page.waitForSelector('.settings-page, [class*="settings"]');

  // Find and click the logout button in the header/sidebar
  await page.click('button:has-text("Sign out"), button:has-text("Logout"), button:has-text("Log out")');

  // After logout, navigating to /settings should redirect to /login
  await page.goto('/settings');
  await page.waitForURL(/\/login/);
});

// ── Route guards ──────────────────────────────────────────────────────────────

test('unauthenticated access to /settings redirects to /login', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForURL(/\/login/);
});

test('client accessing /owner/dashboard is redirected to home', async ({ page }) => {
  await loginInBrowser(page, ACCOUNTS.client);
  await page.goto('/owner/dashboard');
  await page.waitForURL('/');
});

// ── Signup page ───────────────────────────────────────────────────────────────

test('signup page renders first name, last name, email, and password fields', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.locator('#firstName')).toBeVisible();
  await expect(page.locator('#lastName')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toContainText('Create account');
});

test('signup - missing first name shows required error', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('#lastName', 'Test');
  await page.fill('#email', 'missing@example.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.locator('.form-field__error').first()).toBeVisible();
});

test('signup - password shorter than 8 characters shows length error', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('#firstName', 'Test');
  await page.fill('#lastName', 'User');
  await page.fill('#email', 'pw-short@example.com');
  await page.fill('#password', 'short');
  await page.click('button[type="submit"]');
  // Error must mention 8 characters
  const errorText = await page.locator('.form-field__error').first().innerText();
  expect(errorText.toLowerCase()).toContain('8');
});

test('signup - happy path creates account and redirects to home', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('#firstName', 'E2E');
  await page.fill('#lastName', 'Tester');
  await page.fill('#email', SIGNUP_EMAIL);
  await page.fill('#password', SIGNUP_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  // Should be logged in — sign-out button visible in header
  await expect(page.locator('.header__signout')).toBeVisible();
});

test('signup - duplicate email shows API error', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('#firstName', 'Dup');
  await page.fill('#lastName', 'User');
  await page.fill('#email', ACCOUNTS.client.email); // already registered
  await page.fill('#password', SIGNUP_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page.locator('.auth-card__api-error')).toBeVisible();
});

test('signup - "Sign in" link navigates to /login', async ({ page }) => {
  await page.goto('/signup');
  await page.click('a[href="/login"]');
  await page.waitForURL('/login');
});

// ── Forgot password ───────────────────────────────────────────────────────────

test('forgot-password page renders email field and send button', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toContainText('Send reset link');
});

test('forgot-password - invalid email shows inline error', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.fill('#email', 'not-an-email');
  await page.click('button[type="submit"]');
  await expect(page.locator('.form-field__error')).toBeVisible();
});

test('forgot-password - any email submission shows success card', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.fill('#email', ACCOUNTS.client.email);
  await page.click('button[type="submit"]');
  // Always shows the same success card (no enumeration)
  await expect(page.locator('.auth-card__title')).toContainText('Check your email');
});

test('forgot-password - "Back to sign in" link navigates to /login', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.click('a[href="/login"]');
  await page.waitForURL('/login');
});

// ── Reset password ────────────────────────────────────────────────────────────

test('reset-password - missing token shows "Invalid reset link" card', async ({ page }) => {
  await page.goto('/reset-password'); // no ?token param
  await expect(page.locator('.auth-card__title')).toContainText('Invalid reset link');
});

test('reset-password - mismatched passwords show validation error', async ({ page }) => {
  await page.goto('/reset-password?token=any-fake-token');
  await page.fill('#password', 'NewPassword1');
  await page.fill('#confirmPassword', 'DifferentPass1');
  await page.click('button[type="submit"]');
  await expect(page.locator('.form-field__error')).toBeVisible();
});

test('reset-password - password too short shows length error', async ({ page }) => {
  await page.goto('/reset-password?token=any-fake-token');
  await page.fill('#password', 'short');
  await page.fill('#confirmPassword', 'short');
  await page.click('button[type="submit"]');
  const errorText = await page.locator('.form-field__error').first().innerText();
  expect(errorText.toLowerCase()).toContain('8');
});

test('reset-password - full flow: issue token → reset → success → sign in', async ({ page, request }) => {
  const NEW_PASSWORD = 'NewE2EPassword1';

  // Step 1: Issue a reset token via the dev debug endpoint
  const tokenRes = await request.post('/api/v1/debug/issue-reset-token', {
    data: { email: ACCOUNTS.client.email },
  });
  expect(tokenRes.ok()).toBe(true);
  const { data: { token } } = await tokenRes.json();

  // Step 2: Navigate to the reset page with the real token
  await page.goto(`/reset-password?token=${token}`);
  await expect(page.locator('.auth-card__title')).toContainText('Set a new password');

  // Step 3: Fill in the new password
  await page.fill('#password', NEW_PASSWORD);
  await page.fill('#confirmPassword', NEW_PASSWORD);
  await page.click('button[type="submit"]');

  // Step 4: Success card appears
  await expect(page.locator('.auth-card__title')).toContainText('Password updated');
  clientPasswordChanged = true;

  // Step 5: Click "Sign in" link and verify login works with the new password
  await page.click('a[href="/login"]');
  await page.waitForURL('/login');
  await page.fill('#email', ACCOUNTS.client.email);
  await page.fill('#password', NEW_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
});
