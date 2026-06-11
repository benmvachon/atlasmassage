import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run the e2e stack on isolated ports (3099/5174) so it never conflicts with
// the dev server (3001/5173). Setting these before defineConfig means all
// webServer child processes inherit them; dotenv in the API won't override
// EMAIL_HOST because it is already present in the inherited environment.
process.env.EMAIL_HOST = '';
process.env.PORT = '3099';
process.env.VITE_PORT = '5174';
process.env.API_PORT = '3099';

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
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:web',
      cwd: resolve(__dirname, '../..'),
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
