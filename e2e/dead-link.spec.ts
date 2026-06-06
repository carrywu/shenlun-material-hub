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
      // Should NOT have NEXT_NOT_FOUND or 404
      const body = await page.textContent('body');
      expect(body).not.toContain('NEXT_NOT_FOUND');
      expect(body).not.toContain('404');
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
      const body = await page.textContent('body');
      expect(body).not.toContain('NEXT_NOT_FOUND');
      expect(body).not.toContain('404');
    });
  }
});
