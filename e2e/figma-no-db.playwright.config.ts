import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.FIGMA_ALIGNMENT_BASE_URL || 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: '.',
  testMatch: /figma-approved-no-db\.spec\.ts/,
  timeout: 60 * 1000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command:
      'NEXT_TELEMETRY_DISABLED=1 JWT_SECRET=figma-no-db-secret AI_CONFIG_ENCRYPTION_KEY=test-encryption-key-32bytes DATABASE_URL=postgresql://shenlun:shenlun_dev@127.0.0.1:5432/shenlun_material_hub pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
