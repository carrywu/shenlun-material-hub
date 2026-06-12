import { defineConfig, devices } from '@playwright/test';

// 当 PLAYWRIGHT_BASE_URL 指向非 localhost（如打已部署的 staging）
// 时，跳过自带 dev server，直接打远端目标。
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const isRemoteTarget =
  !baseUrl.includes('127.0.0.1') && !baseUrl.includes('localhost');

export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // P0-004 (B3): 顶层不再设 storageState——每个 spec 用 test.use({ storageState }) 显式声明身份
    // （admin/.auth/admin-storage.json, verified/usera/userb 各自文件, 或空 {cookies:[],origins:[]} 表匿名）
  },
  snapshotDir: './e2e/__screenshots__',
  globalSetup: require.resolve('./e2e/global-setup'),
  projects: [
    {
      name: 'anonymous',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'userA',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/usera-storage.json' },
    },
    {
      name: 'userB',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/userb-storage.json' },
    },
    {
      name: 'verified',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/verified-storage.json' },
    },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin-storage.json' },
    },
  ],
  // 打远端 staging 时不本地起 dev server；本地开发/CI 才起 dev server
  ...(isRemoteTarget
    ? {}
    : {
        webServer: {
          command:
            'ADMIN_USERNAME=admin JWT_SECRET=playwright-test-secret AI_CONFIG_ENCRYPTION_KEY=test-encryption-key-32bytes pnpm dev',
          port: 3001,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }),
});
