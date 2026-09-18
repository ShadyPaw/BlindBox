import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
