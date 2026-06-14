import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../playwright-report-new', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'anonymous',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
      dependencies: ['global-setup'],
      testIgnore: [
        '**/admin-*.spec.ts',
        '**/ai-assessment.spec.ts',
        '**/sources.spec.ts',
        '**/wewe-rss.spec.ts',
        '**/material-cards.spec.ts',
      ],
    },
    {
      name: 'userA',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/usera.json'),
      },
      dependencies: ['global-setup'],
    },
    {
      name: 'verified',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/verified.json'),
      },
      dependencies: ['global-setup'],
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, '.auth/admin.json'),
      },
      dependencies: ['global-setup'],
    },
    {
      name: 'global-setup',
      testMatch: /global-setup\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm start',
    port: 3001,
    reuseExistingServer: !isCI,
    timeout: 30_000,
    env: {
      DATABASE_URL: 'postgresql://shenlun:shenlun_dev@localhost:5432/shenlun_material_hub?schema=public',
      JWT_SECRET: 'playwright-test-secret',
      AI_CONFIG_ENCRYPTION_KEY: 'shenlun-material-hub-encryption-key-2024',
      ADMIN_USERNAME: 'admin',
    },
  },
});
