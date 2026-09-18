import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: '.env', quiet: true });
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'storefront', testIgnore: /catalog-runtime\.spec\.ts/ },
    // Runtime catalog tests temporarily publish isolated fixtures after baseline counts are checked.
    {
      name: 'catalog-runtime',
      testMatch: /catalog-runtime\.spec\.ts/,
      dependencies: ['storefront'],
    },
  ],
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @box/web start',
      url: 'http://127.0.0.1:3104/health',
      env: { PORT: '3104', API_INTERNAL_URL: 'http://127.0.0.1:9' },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @box/api start',
      url: 'http://127.0.0.1:3102/health/ready',
      env: {
        NODE_ENV: 'test',
        API_PORT: '3102',
        API_HOST: '127.0.0.1',
        CORS_ORIGINS: 'http://127.0.0.1:3100',
        WEB_ORIGIN: 'http://127.0.0.1:3100',
        MAIL_TRANSPORT: 'file',
        MAIL_DIRECTORY: resolve('.local/test-mail'),
        LOG_LEVEL: 'silent',
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @box/web start',
      url: 'http://127.0.0.1:3100/health',
      env: { PORT: '3100', API_INTERNAL_URL: 'http://127.0.0.1:3102' },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @box/admin start',
      url: 'http://127.0.0.1:3101/health',
      env: { PORT: '3101' },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
