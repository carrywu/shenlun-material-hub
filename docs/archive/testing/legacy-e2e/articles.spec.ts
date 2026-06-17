import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading, expectEmptyStateVisible } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';
import { pageHeader, emptyState } from './helpers/selectors';
import { attachApiMonitor } from './helpers/api';

test.describe('文章列表页 /articles', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('页面加载成功', async ({ page }) => {
    await navigateTo(page, '/articles');
    await expectNoInfiniteLoading(page);
    // Page should have content
    await expect(page.locator('main')).toBeVisible();
  });

  test('无 API 500 错误', async ({ page }) => {
    const monitor = attachApiMonitor(page);
    await navigateTo(page, '/articles');
    await page.waitForLoadState('networkidle').catch(() => {});
    monitor.assertNo500();
  });

  test('Tab 切换功能', async ({ page }) => {
    await navigateTo(page, '/articles');
    await expectNoInfiniteLoading(page);
    
    // Check for tab elements
    const tabs = page.locator('[role="tab"], [data-state]');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      // Click each tab and verify no errors
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        await tabs.nth(i).click();
        await expectNoInfiniteLoading(page);
      }
    }
  });

  test('文章点击跳转详情', async ({ page }) => {
    await navigateTo(page, '/articles');
    await expectNoInfiniteLoading(page);
    
    // Look for article links/titles
    const firstArticle = page.locator('article, [data-slot="card"], a[href*="/articles/"]').first();
    if (await firstArticle.isVisible().catch(() => false)) {
      await firstArticle.click();
      await expect(page).toHaveURL(/\/articles\/\w+/);
      await expectNoInfiniteLoading(page);
    }
  });
});

test.describe('文章列表匿名访问', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未登录访问文章列表重定向到登录', async ({ page }) => {
    await page.goto('/articles');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
