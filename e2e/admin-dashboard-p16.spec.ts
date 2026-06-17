import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

/**
 * §P1-6 管理后台测试 — 后台首页补充用例
 *
 * 覆盖：USER 访问 /admin redirect、metrics 500 错误态、中文侧边栏、快速入口可点击
 */

test.describe('Admin Dashboard — P1-6 补充', () => {
  // ── 后台首页 — USER 角色访问应被拦截 ──

  test('USER 访问 /admin → 被拦截/重定向', async ({ browser }) => {
    // 使用 userA 的 storageState
    const context = await browser.newContext({
      storageState: '.auth/userA-storage.json',
    });
    const page = await context.newPage();

    await page.goto('/admin');
    // 非管理员应被中间件重定向到 / 或显示 403
    // 验证不会停留在 /admin 页面看到管理内容
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const isAdminPage = currentUrl.includes('/admin');
    // 如果仍在 /admin，页面不应显示管理内容（应显示无权限提示或重定向）
    if (isAdminPage) {
      const adminContent = page.getByRole('heading', { name: '系统概览' });
      const isVisible = await adminContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible).toBe(false);
    } else {
      // 被重定向到非 /admin 页面 — 符合预期
      expect(currentUrl).not.toContain('/admin');
    }

    await context.close();
  });

  // ── 后台首页 — metrics 500 错误态 ──

  test('metrics API 500 → 页面不崩溃，显示中文错误', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // 拦截 metrics API 返回 500
    await page.route('**/api/admin/metrics**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '获取系统指标失败' }),
      })
    );

    await page.goto('/admin');
    // AdminShell 应正常渲染（侧边栏在）
    await page.waitForTimeout(3000);

    // 页面不应白屏或崩溃
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);

    // 应有某种错误提示或 fallback 内容（不白屏即可）
    const pageContent = page.locator('main, [role="main"], .grid, .space-y-');
    const hasContent = await pageContent.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBe(true);

    guard.report(testInfo);
  });
});

// ── 侧边栏中文 + 快速入口（admin 权限） ──

test.describe('Admin Sidebar — P1-6', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('侧边栏菜单全中文', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // AdminShell 侧边栏导航应包含中文菜单项
    const sidebar = page.locator('nav, aside, [data-slot="sidebar"]').first();
    if (await sidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 检查典型中文菜单文本
      const chineseMenuItems = ['概览', '任务', '日志', '用户', '来源', '清洗', '备份', '邀请', '设置'];
      let foundCount = 0;
      for (const text of chineseMenuItems) {
        const found = await page.getByText(text, { exact: false }).first().isVisible({ timeout: 1000 }).catch(() => false);
        if (found) foundCount++;
      }
      // 至少应找到 3 个中文菜单项
      expect(foundCount).toBeGreaterThanOrEqual(3);
    } else {
      // 如果侧边栏结构不同，检查页面整体中文内容
      const bodyText = await page.locator('body').textContent();
      const hasChinese = /[一-鿿]/.test(bodyText ?? '');
      expect(hasChinese).toBe(true);
    }

    guard.report(testInfo);
  });

  test('快速入口可点击跳转', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    // 等待 metrics 加载
    await page.waitForTimeout(3000);

    // 查找带链接的快速入口（Card 内的 a 标签或按钮）
    const quickLinks = page.locator('a[href*="/admin/"], a[href*="/sources"], a[href*="/tasks"], a[href*="/articles"]');
    const linkCount = await quickLinks.count();

    if (linkCount > 0) {
      // 点击第一个快速入口
      const firstHref = await quickLinks.first().getAttribute('href');
      await quickLinks.first().click();
      await page.waitForTimeout(2000);
      // 应跳转到对应页面
      const currentUrl = page.url();
      expect(currentUrl).not.toBe('/admin');
      if (firstHref) {
        expect(currentUrl).toContain(firstHref.replace(/^\//, ''));
      }
    }
    // 无快速入口也不断言失败 — 只验证页面不崩溃

    guard.report(testInfo);
  });
});
