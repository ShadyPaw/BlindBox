import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @box/web start',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @box/admin start',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
