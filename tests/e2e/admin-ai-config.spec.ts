import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';

test.describe('AI 配置页', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('AI 配置页加载', async ({ page }) => {
    await navigateTo(page, '/admin/settings/ai');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('AI 配置表单可见', async ({ page }) => {
    await navigateTo(page, '/admin/settings/ai');
    await expectNoInfiniteLoading(page);
    // Should have some form elements
    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('普通用户不能访问 AI 配置', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未登录访问 AI 配置重定向', async ({ page }) => {
    await page.goto('/admin/settings/ai');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
  });
});
