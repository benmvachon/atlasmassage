/**
 * Playwright global setup — runs once before all workers start.
 * Logs in as each test account and writes tokens to .auth-state.json.
 * This reduces login calls across the suite to exactly 3.
 */
import { request as playwrightRequest } from '@playwright/test';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(config) {
  const baseURL = config.projects?.[0]?.use?.baseURL ?? 'http://localhost:5173';
  const context = await playwrightRequest.newContext({ baseURL });

  async function login(email, password) {
    const res = await context.post('/api/v1/auth/login', {
      data: { email, password },
    });
    if (!res.ok()) {
      const text = await res.text();
      throw new Error(`Login failed for ${email}: ${res.status()} ${text}`);
    }
    const body = await res.json();
    return { token: body.data.accessToken, userId: body.data.user.id };
  }

  const [owner, sarah, marcus] = await Promise.all([
    login('owner@atlasmassage.com',  'atlas-owner-2024'),
    login('sarah@atlasmassage.com',  'atlas-therapist-2024'),
    login('marcus@atlasmassage.com', 'atlas-therapist-2024'),
  ]);

  writeFileSync(
    resolve(__dirname, '.auth-state.json'),
    JSON.stringify({ owner, sarah, marcus }, null, 2)
  );

  await context.dispose();
}
