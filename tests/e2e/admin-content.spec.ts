import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';
import { attachApiMonitor } from './helpers/api';

test.describe('后台内容管理', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('仪表板加载正常', async ({ page }) => {
    await navigateTo(page, '/admin');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main, [data-slot="page-header"]').first()).toBeVisible();
  });

  test('文章管理页加载', async ({ page }) => {
    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('用户管理页加载', async ({ page }) => {
    const monitor = attachApiMonitor(page);
    await navigateTo(page, '/admin/users');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
    monitor.assertNo500();
  });

  test('任务监控页加载', async ({ page }) => {
    await navigateTo(page, '/admin/tasks');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('系统日志页加载', async ({ page }) => {
    await navigateTo(page, '/admin/logs');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('备份页加载', async ({ page }) => {
    await navigateTo(page, '/admin/backup');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('数据清理页加载', async ({ page }) => {
    await navigateTo(page, '/admin/clean');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
