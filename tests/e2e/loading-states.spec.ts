import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { mockApiFailure, mockApiResponse } from './helpers/api';

test.describe('Loading 卡死专项 - 前台', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('文章列表 API 500 时 Loading 释放', async ({ page }) => {
    await mockApiFailure(page, /\/api\/articles/, 500);
    await page.goto('/articles');
    await expectNoInfiniteLoading(page, 15_000);
    // Should show error state or empty state, not infinite loading
    await expect(page.locator('main')).toBeVisible();
  });

  test('搜索 API 超时时 Loading 释放', async ({ page }) => {
    await page.route(/\/api\/search/, async route => {
      await new Promise(r => setTimeout(r, 12_000)); // Simulate slow response
      await route.fulfill({ status: 200, body: JSON.stringify({ items: [], total: 0 }) });
    });
    await page.goto('/search');
    // Loading should eventually clear
    await expectNoInfiniteLoading(page, 15_000);
  });

  test('素材卡列表 API 失败时 Loading 释放', async ({ page }) => {
    await mockApiFailure(page, /\/api\/material-cards/, 500);
    await page.goto('/cards');
    await expectNoInfiniteLoading(page, 15_000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('复习页 API 失败时 Loading 释放', async ({ page }) => {
    await mockApiFailure(page, /\/api\/review/, 500);
    await page.goto('/review');
    await expectNoInfiniteLoading(page, 15_000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('设置页正常加载', async ({ page }) => {
    await page.goto('/settings');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Loading 卡死专项 - 后台', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('后台仪表板 API 失败时不卡死', async ({ page }) => {
    // Skip for anonymous users — admin dashboard redirects to login
    const cookies = await page.context().cookies();
    if (cookies.length === 0) { test.skip(); return; }
    await mockApiFailure(page, /\/api\/admin\/metrics/, 500);
    await page.goto('/admin');
    await expectNoInfiniteLoading(page, 15_000);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('用户管理 API 失败时不卡死', async ({ page }) => {
    await mockApiFailure(page, /\/api\/admin\/users/, 500);
    await page.goto('/admin/users');
    await expectNoInfiniteLoading(page, 15_000);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('日志页 API 失败时不卡死', async ({ page }) => {
    await mockApiFailure(page, /\/api\/admin\/logs/, 500);
    await page.goto('/admin/logs');
    await expectNoInfiniteLoading(page, 15_000);
    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('快速重复点击防护', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('搜索按钮连续点击不崩溃', async ({ page }) => {
    await page.goto('/search');
    await expectNoInfiniteLoading(page);
    
    const searchInput = page.locator('input[type="text"], input[placeholder*="搜索"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      const searchBtn = page.getByRole('button', { name: /搜索|Search/i }).first();
      if (await searchBtn.isVisible().catch(() => false)) {
        // Rapid clicks
        await Promise.all([
          searchBtn.click(),
          searchBtn.click(),
          searchBtn.click(),
        ]);
        await expectNoInfiniteLoading(page, 10_000);
      }
    }
  });
});
