import { expect, test } from '@playwright/test';

test.describe('Dead Link / Empty Page 检查', () => {
  // Public routes — no auth needed
  const publicRoutes = [
    '/articles', '/explore', '/discover', '/search', '/cards',
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

  // Protected routes — need auth (storageState provides it)
  const protectedRoutes = [
    '/admin', '/admin/tasks', '/admin/logs', '/admin/users',
    '/admin/backup', '/admin/clean', '/admin/settings/ai',
    '/admin/integrations/wewe-rss', '/admin/articles',
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
