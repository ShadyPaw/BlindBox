import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['apps/**/src/**/*.ts', 'packages/**/src/**/*.ts'],
      exclude: ['**/generated/**'],
    },
  },
});
