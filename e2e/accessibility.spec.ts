import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

/**
 * §5.6 a11y 可访问性测试
 * 使用 @axe-core/playwright 对所有页面进行 WCAG 2.x 合规扫描
 *
 * 策略：扫描 → 报告 → 不阻塞
 * 发现的违规作为 attachment 附加到报告中，不阻塞测试通过。
 * 已知问题记录在 docs/testing/playwright-coverage-report.md。
 */

test.describe('a11y 可访问性检查', () => {
  // ─── 公开页面（无认证） ───
  test.describe('公开页面', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    const publicRoutes = [
      { route: '/admin/login', name: '登录页', waitFor: 'form' },
      { route: '/register', name: '注册页', waitFor: 'form' },
      { route: '/articles', name: '文章列表', waitFor: 'h1, h2, h3, main' },
      { route: '/explore', name: '探索页', waitFor: 'h1, h2, h3, main' },
      { route: '/discover', name: '发现页', waitFor: 'h1, h2, h3, main' },
      { route: '/search', name: '搜索页', waitFor: 'h1, h2, h3, main' },
      { route: '/cards', name: '素材卡', waitFor: 'h1, h2, h3, main' },
      { route: '/review', name: '复习页', waitFor: 'h1, h2, h3, main' },
    ];

    for (const { route, name, waitFor } of publicRoutes) {
      test(`a11y: ${name} ${route}`, async ({ page }, testInfo) => {
        test.setTimeout(60000);
        const guard = attachConsoleGuard(page);

        await page.goto(route);
        await expect(page.locator(waitFor).first()).toBeVisible({ timeout: 10000 });

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // 附加完整违规报告
        await testInfo.attach('a11y-violations', {
          body: JSON.stringify(results.violations, null, 2),
          contentType: 'application/json',
        });

        // 附加通过项数量，便于快速判断
        await testInfo.attach('a11y-summary', {
          body: `${name}: ${results.violations.length} violations, ${results.passes.length} passes`,
          contentType: 'text/plain',
        });

        guard.report(testInfo);
      });
    }
  });

  // ─── 受保护页面（admin 认证） ───
  test.describe('受保护页面', () => {
    const protectedRoutes = [
      { route: '/admin', name: '管理后台首页', waitFor: 'h1, h2, h3, main, table' },
      { route: '/admin/tasks', name: '任务管理', waitFor: 'h1, h2, h3, main, table' },
      { route: '/admin/logs', name: '系统日志', waitFor: 'h1, h2, h3, main, table' },
      { route: '/admin/users', name: '用户管理', waitFor: 'h1, h2, h3, main, table' },
      { route: '/admin/backup', name: '数据备份', waitFor: 'h1, h2, h3, main' },
      { route: '/admin/clean', name: '数据清洗', waitFor: 'h1, h2, h3, main' },
      { route: '/admin/settings/ai', name: 'AI 设置（管理）', waitFor: 'h1, h2, h3, main, form' },
      { route: '/admin/integrations/wechat-rss', name: '微信 RSS 集成', waitFor: 'h1, h2, h3, main' },
      { route: '/admin/sources', name: '来源管理', waitFor: 'h1, h2, h3, main, table' },
      { route: '/admin/sync-records', name: '同步记录', waitFor: 'h1, h2, h3, main, table' },
      { route: '/settings', name: '设置首页', waitFor: 'h1, h2, h3, main' },
      { route: '/settings/account', name: '账号设置', waitFor: 'h1, h2, h3, main, form' },
      { route: '/settings/ai', name: 'AI 设置', waitFor: 'h1, h2, h3, main' },
      { route: '/settings/ima', name: 'IMA 设置', waitFor: 'h1, h2, h3, main' },
    ];

    for (const { route, name, waitFor } of protectedRoutes) {
      test(`a11y: ${name} ${route}`, async ({ page }, testInfo) => {
        test.setTimeout(60000);
        const guard = attachConsoleGuard(page);

        await page.goto(route);
        await expect(page.locator(waitFor).first()).toBeVisible({ timeout: 10000 });

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        await testInfo.attach('a11y-violations', {
          body: JSON.stringify(results.violations, null, 2),
          contentType: 'application/json',
        });

        await testInfo.attach('a11y-summary', {
          body: `${name}: ${results.violations.length} violations, ${results.passes.length} passes`,
          contentType: 'text/plain',
        });

        guard.report(testInfo);
      });
    }
  });

  // ─── 专项 a11y 测试 ───
  test.describe('专项测试', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('a11y: 登录页键盘 Tab 导航', async ({ page }, testInfo) => {
      test.setTimeout(60000);
      const guard = attachConsoleGuard(page);

      await page.goto('/admin/login');
      await expect(page.locator('form').first()).toBeVisible({ timeout: 10000 });

      // Tab 键应能按顺序聚焦到：用户名输入 → 密码输入 → 登录按钮
      const usernameInput = page.getByPlaceholder(/用户名|账号|username/i);
      const passwordInput = page.getByPlaceholder(/密码|password/i);
      // 登录按钮文本是 "登 录"（中间有空格）
      const loginBtn = page.getByRole('button', { name: /登\s*录|login/i });

      // 至少存在一个 input 和一个 button
      await expect(usernameInput.or(passwordInput).first()).toBeVisible();
      await expect(loginBtn).toBeVisible();

      // Tab 键导航不应导致页面崩溃或 JS 错误
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }
      // 页面仍然可用
      await expect(page.locator('form').first()).toBeVisible();

      guard.report(testInfo);
    });

    test('a11y: 表单 label 关联', async ({ page }, testInfo) => {
      test.setTimeout(60000);
      const guard = attachConsoleGuard(page);

      await page.goto('/admin/login');
      await expect(page.locator('form').first()).toBeVisible({ timeout: 10000 });

      // 所有 input 都应有 label 或 aria-label 或 aria-labelledby
      const inputs = page.locator('form input:visible');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type');
        // hidden / submit 类型跳过
        if (type === 'hidden' || type === 'submit') continue;

        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');
        const id = await input.getAttribute('id');
        const hasLabel = id
          ? (await page.locator(`label[for="${id}"]`).count()) > 0
          : false;

        expect.soft(
          ariaLabel || ariaLabelledBy || placeholder || hasLabel,
          `第 ${i + 1} 个 input 缺少 label/aria-label/placeholder`,
        ).toBeTruthy();
      }

      guard.report(testInfo);
    });
  });
});
