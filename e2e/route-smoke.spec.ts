import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';

test.describe('回归测试 - 所有页面不白屏', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  const adminPages = [
    '/admin',
    '/admin/articles',
    '/admin/sources',
    '/admin/users',
    '/admin/tasks',
    '/admin/logs',
    '/admin/sync-records',
    '/admin/backup',
    '/admin/clean',
    '/admin/integrations/wechat-rss',
    '/admin/settings/ai',
    '/admin/settings/quotas',
  ];

  const userPages = [
    '/',
    '/articles',
    '/cards',
    '/search',
    '/review',
    '/settings',
    '/settings/account',
    '/settings/ai',
    '/settings/ima',
    '/settings/integrations',
    '/subscriptions',
    '/sync-records',
  ];

  for (const path of [...adminPages, ...userPages]) {
    test(`页面 ${path} 不白屏`, async ({ page }) => {
      await page.goto(path);
      await expectNoInfiniteLoading(page);
      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(10);
    });
  }
});

test.describe('回归测试 - 公开页面', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登录页不白屏', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('注册页不白屏', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: '注册' })).toBeVisible();
  });

  test('后台登录页不白屏', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录管理后台' })).toBeVisible();
  });
});
