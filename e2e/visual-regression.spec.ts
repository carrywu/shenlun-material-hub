import { type Locator, expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

/**
 * §5.7 Visual Regression 视觉回归测试
 * 使用 toHaveScreenshot() 建立基线截图，后续运行自动对比
 */

test.describe('Visual Regression 视觉回归', () => {
  // ─── 公开页面（无认证） ───
  test.describe('公开页面', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('visual: 登录页 /admin/login', async ({ page }, testInfo) => {
      test.setTimeout(60000);
      const guard = attachConsoleGuard(page);

      await page.goto('/admin/login');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('form').first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('login-page.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });

      guard.report(testInfo);
    });
  });

  // ─── 受保护页面（admin 认证） ───
  test.describe('受保护页面', () => {
    const routes = [
      { route: '/', slug: 'dashboard', waitSelector: 'h1, h2, h3, main' },
      { route: '/articles', slug: 'articles', waitSelector: 'h1, h2, h3, main' },
      { route: '/explore', slug: 'explore', waitSelector: 'h1, h2, h3, main' },
      { route: '/discover', slug: 'discover', waitSelector: 'h1, h2, h3, main' },
      { route: '/cards', slug: 'cards', waitSelector: 'h1, h2, h3, main' },
      { route: '/search', slug: 'search', waitSelector: 'h1, h2, h3, main' },
      { route: '/review', slug: 'review', waitSelector: 'h1, h2, h3, main' },
      { route: '/settings', slug: 'settings', waitSelector: 'h1, h2, h3, main' },
      { route: '/settings/account', slug: 'settings-account', waitSelector: 'form' },
      { route: '/settings/ima', slug: 'settings-ima', waitSelector: 'h1, h2, h3, main' },
      { route: '/admin', slug: 'admin-dashboard', waitSelector: 'h1, h2, h3, main, table' },
      { route: '/admin/sources', slug: 'admin-sources', waitSelector: 'h1, h2, h3, main, table' },
      { route: '/admin/integrations/wewe-rss', slug: 'admin-wewe-rss', waitSelector: 'h1, h2, h3, main' },
    ];

    for (const { route, slug, waitSelector } of routes) {
      test(`visual: ${slug} ${route}`, async ({ page }, testInfo) => {
        test.setTimeout(60000);
        const guard = attachConsoleGuard(page);

        // Set fixed viewport for consistent screenshot dimensions
        await page.setViewportSize({ width: 1280, height: 720 });

        await page.goto(route);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator(waitSelector).first()).toBeVisible({ timeout: 10000 });
        // 额外等待动画和异步渲染稳定
        await page.waitForTimeout(500);

        // 遮罩动态元素：header 中的用户名/角色信息
        const mask: Locator[] = [];
        const headerUserArea = page.locator('header').locator('span.text-xs').first();
        if (await headerUserArea.isVisible().catch(() => false)) {
          mask.push(headerUserArea);
        }

        await expect(page).toHaveScreenshot(`${slug}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
          mask: mask.length > 0 ? mask : undefined,
        });

        guard.report(testInfo);
      });
    }
  });
});
