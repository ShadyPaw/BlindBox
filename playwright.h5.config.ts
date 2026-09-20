import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// The frontend is a separate checkout. Never silently test the monorepo's old web app.
const h5 = process.env.H5_REPOSITORY_PATH;
if (
  !h5 ||
  JSON.parse(readFileSync(resolve(h5, 'package.json'), 'utf8')).name !==
    'blindbox-h5'
)
  throw new Error(
    'H5_REPOSITORY_PATH must point to the standalone BindBoxH5 checkout',
  );
if (!process.env.DATABASE_URL || !process.env.REDIS_URL)
  throw new Error('Supply isolated test DATABASE_URL and REDIS_URL');

export default defineConfig({
  testDir: './tests/h5',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/h5' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3200',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @box/api start',
      url: 'http://127.0.0.1:3202/health/ready',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        API_HOST: '127.0.0.1',
        API_PORT: '3202',
        WEB_ORIGIN: 'http://127.0.0.1:3200',
        CORS_ORIGINS: 'http://127.0.0.1:3200',
        MAIL_TRANSPORT: 'file',
        MAIL_DIRECTORY: resolve('.local/h5-mail'),
        LOG_LEVEL: 'silent',
      },
    },
    {
      command: 'pnpm start',
      cwd: resolve(h5),
      url: 'http://127.0.0.1:3200/health',
      reuseExistingServer: false,
      env: {
        PORT: '3200',
        HOSTNAME: '127.0.0.1',
        API_INTERNAL_URL: 'http://127.0.0.1:3202',
        FRONTEND_PREVIEW: '0',
      },
    },
    {
      command: 'pnpm start',
      cwd: resolve(h5),
      url: 'http://127.0.0.1:3204/health',
      reuseExistingServer: false,
      env: {
        PORT: '3204',
        HOSTNAME: '127.0.0.1',
        API_INTERNAL_URL: 'http://127.0.0.1:9',
        FRONTEND_PREVIEW: '0',
      },
    },
  ],
});
