import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// E2E stack runs on isolated ports (3099 / 5174) to never conflict with the
// dev server (3001 / 5173).
//
// EMAIL_HOST is explicitly blanked out here AND passed via the webServer env
// option so that dotenv inside the spawned API process can never override it
// with the real .env value, regardless of how npm spawns child processes.
// NODE_ENV=test is an additional belt-and-suspenders guard checked directly
// in emailService so that no code path sends real mail during tests.

const E2E_ENV = {
  NODE_ENV: 'test',
  EMAIL_HOST: '',
  PORT: '3099',
  API_PORT: '3099',
  VITE_PORT: '5174',
};

// Propagate into this process so globalSetup and other config-time code sees
// the right values.
Object.assign(process.env, E2E_ENV);

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/globalSetup.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:api',
      cwd: resolve(__dirname, '../..'),
      url: 'http://localhost:3099/health',
      // Always spawn fresh so E2E_ENV (EMAIL_HOST='', NODE_ENV=test) is
      // guaranteed. Use `npm run test:e2e` from the root to pre-clear ports.
      reuseExistingServer: false,
      env: E2E_ENV,
    },
    {
      command: 'npm run dev:web',
      cwd: resolve(__dirname, '../..'),
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      env: E2E_ENV,
    },
  ],
});
