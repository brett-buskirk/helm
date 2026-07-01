import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Boots the Vite dev server on :1420 (the app is a local-first SPA —
 * no backend), then drives real Chromium. Each test gets a fresh browser context,
 * so IndexedDB starts empty every time.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['line']] : 'list',
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
