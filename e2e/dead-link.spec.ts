import { expect, test } from '@playwright/test';

// 公开路由：无需登录态
test.describe('公开页面 Dead Link 检查', () => {
  // P0-004 (B3): 清空 storageState，确保真正匿名访问公开页
  test.use({ storageState: { cookies: [], origins: [] } });

  const publicRoutes = [
    '/articles', '/search', '/cards',
    '/review', '/register', '/admin/login',
  ];

  for (const route of publicRoutes) {
    test(`公开页面 ${route} 非空白页`, async ({ page }) => {
      await page.goto(route);
      // Page should have content — at least h1, h2, h3, main, or form
      await expect(
        page.locator('h1, h2, h3, main, form').first()
      ).toBeVisible({ timeout: 10000 });
      // Check page title does not indicate 404
      const title = await page.title();
      expect(title).not.toMatch(/404|Not Found/i);
      // Check h1 heading for 404 indicators
      const h1Locator = page.locator('h1');
      if (await h1Locator.count() > 0) {
        const h1Text = await h1Locator.first().textContent();
        expect(h1Text).not.toMatch(/404|not.?found/i);
      }
    });
  }
});

// 受保护路由：需 admin 登录态
test.describe('受保护页面 Dead Link 检查', () => {
  // P0-004 (B3): 受保护页面用 admin storageState 访问
  test.use({ storageState: '.auth/admin-storage.json' });

  const protectedRoutes = [
    '/admin', '/admin/tasks', '/admin/logs', '/admin/users',
    '/admin/backup', '/admin/clean', '/admin/settings/ai',
    '/admin/integrations/wechat-rss', '/admin/articles',
    '/admin/sync-records', '/settings', '/settings/account',
    '/settings/ai', '/settings/ima',
  ];

  for (const route of protectedRoutes) {
    test(`受保护页面 ${route} 非空白页`, async ({ page }) => {
      await page.goto(route);
      await expect(
        page.locator('h1, h2, h3, main, form, table').first()
      ).toBeVisible({ timeout: 10000 });
      // Check page title does not indicate 404
      const title = await page.title();
      expect(title).not.toMatch(/404|Not Found/i);
      // Check h1 heading for 404 indicators
      const h1Locator = page.locator('h1');
      if (await h1Locator.count() > 0) {
        const h1Text = await h1Locator.first().textContent();
        expect(h1Text).not.toMatch(/404|not.?found/i);
      }
    });
  }
});
