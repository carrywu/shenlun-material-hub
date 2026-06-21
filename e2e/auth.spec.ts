import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe.configure({ mode: 'serial' });

// ─── 登录页 (no auth — start without storageState) ─────────────────

test.describe('登录页（未认证）', () => {
  // These tests need to start without auth cookies so they can test the login flow
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登录页：未登录访问 /admin 重定向到登录页', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId('login-page-header')).toContainText('申论素材管理后台');

    guard.report(testInfo);
  });

  test('登录页：表单元素可见性', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/login');

    // Suspense wrapper means we wait for placeholders to appear
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录管理后台' })).toBeVisible();

    guard.report(testInfo);
  });

  test('登录页：错误密码显示错误提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');

    // Wait for redirect to login page and form to render
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('wrong-password');
    await page.getByRole('button', { name: '登录管理后台' }).click();

    await expect(page.getByText('用户名或密码错误')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);

    guard.report(testInfo);
  });

  test('登录页：正确密码登录成功跳转', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Navigate to /admin first so middleware sets redirect param
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);

    // Wait for Suspense to resolve
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('admin123');
    await page.getByRole('button', { name: '登录管理后台' }).click();

    // Should land on /admin (the redirect target)
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
    await expect(page.getByTestId('admin-shell-heading')).toContainText('系统概览');

    // Verify auth cookie exists and is httpOnly
    const cookies = await page.context().cookies();
    const authToken = cookies.find((c) => c.name === 'auth_token');
    expect(authToken).toBeDefined();
    expect(authToken!.httpOnly).toBe(true);

    guard.report(testInfo);
  });

  test('登录页：接口返回500显示错误提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    // Mock login API to return 500
    await page.route('**/api/auth/login', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: '服务器内部错误' }) })
    );
    await page.goto('/admin/login');
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('admin123');
    await page.locator("form button[type='submit']").click();
    await expect(page.getByText(/错误|失败/)).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });

  test('登录页：直接访问无 redirect 参数跳转首页', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Go directly to login page without redirect param
    await page.goto('/admin/login');
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('admin123');
    await page.getByRole('button', { name: '登录管理后台' }).click();

    // Without redirect param, should go to homepage /
    await expect(page).toHaveURL(/^(?!.*\/admin\/login).*$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\//, { timeout: 5000 });

    guard.report(testInfo);
  });
});

// ─── 导航 (authenticated via global storageState) ──────────────────

test.describe('导航（已认证）', () => {
  // P0-004 (B3): 顶层 storageState 已移除，"已认证" describe 必须显式声明 admin storageState
  test.use({ storageState: '.auth/admin-storage.json' });
  test('登录页：已登录用户访问登录页跳转首页', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Already authenticated via storageState — server component redirects immediately
    await page.goto('/admin/login');

    // 服务端 redirect — 不再需要 30s 等客户端 /api/auth/check fetch
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
    await expect(page.getByTestId('admin-shell-heading')).toBeVisible({ timeout: 15000 });

    guard.report(testInfo);
  });

  test('导航：登录后顶部导航栏可见', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Must navigate to a page first to see the nav header
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 10000 });

    // Check all main nav links in header (Round B nav refactor)
    // Scope to banner (header) to avoid matching homepage quick-link cards
    const nav = page.getByRole('banner');
    await expect(nav.getByRole('link', { name: '首页', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '文章', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '素材卡' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '检索' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '复习' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '设置' })).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：admin 用户可见管理后台入口', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'admin 账户菜单' }).click();
    await expect(page.getByRole('menuitem', { name: /管理后台/ })).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：顶部导航链接可点击跳转', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/');
    // Click 文章
    await page.getByRole('banner').getByRole('link', { name: '文章', exact: true }).click();
    await expect(page).toHaveURL(/\/articles/, { timeout: 10000 });
    // Verify page loaded (not blank)
    await expect(page.locator('body')).toBeVisible();

    // Click 素材卡 (scope to nav to avoid homepage quick-link cards)
    await page.getByRole('banner').getByRole('link', { name: '素材卡' }).click();
    await expect(page).toHaveURL(/\/cards/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：管理后台侧边栏可见', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Navigate to admin area
    await page.goto('/admin');
    await expect(page.getByTestId('admin-shell-heading')).toContainText('系统概览');

    // Verify key sidebar links are visible
    await expect(page.getByRole('link', { name: '文章管理' })).toBeVisible();
    await expect(page.getByRole('link', { name: '来源管理' })).toBeVisible();
    await expect(page.getByRole('link', { name: '异步任务' })).toBeVisible();
    await expect(page.getByRole('link', { name: '系统日志' })).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：侧边栏链接可点击跳转', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    await expect(page.getByTestId('admin-shell-heading')).toContainText('系统概览');

    // Click 异步任务
    await page.getByRole('link', { name: '异步任务' }).click();
    await expect(page).toHaveURL(/\/admin\/tasks/, { timeout: 10000 });
    await expect(page.getByTestId('admin-tasks-page-header')).toBeVisible();

    // Click 系统日志
    await page.getByRole('link', { name: '系统日志' }).click();
    await expect(page).toHaveURL(/\/admin\/logs/, { timeout: 10000 });

    guard.report(testInfo);
  });

  test('导航：侧边栏折叠', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    await expect(page.getByTestId('admin-shell-heading')).toContainText('系统概览');

    const sidebar = page.getByTestId('admin-sidebar');
    const toggle = page.getByTestId('admin-sidebar-toggle');

    // 验证初始状态为展开
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const widthBefore = await sidebar.evaluate((el) => el.getBoundingClientRect().width);

    // 点击折叠
    await toggle.click();

    // 状态立即切换（不受 CSS 动画时序影响）
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // 宽度最终变窄（poll 等待 CSS transition 完成）
    await expect.poll(
      async () => await sidebar.evaluate((el) => el.getBoundingClientRect().width)
    ).toBeLessThan(widthBefore);

    // 再次点击展开
    await toggle.click();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    guard.report(testInfo);
  });
});

// ─── 登出 (用临时登录，不污染共享 storageState) ───────────────────
//
// ★ 关键：登出测试**不能**复用 `.auth/admin-storage.json`（globalSetup 写入的共享
// admin token T1）。logout API 会 revokeSession(T1) 从 DB 删除该 token，导致全量
// 序列里后续所有用 admin-storage.json 的 spec 拿失效 token → 401 → 集体失败
// （诊断见 docs/superpowers/specs/2026-06-18-e2e-stability-fix.md §3）。
// 改为匿名 context 起，自己通过 UI 登录拿一个 fresh session，登出只 revoke 这个
// fresh token，T1 不受影响。

test.describe('登出（已认证）', () => {
  // 匿名 context 起，避免复用共享 storageState 的 token
  test.use({ storageState: { cookies: [], origins: [] } });
  test('登出：点击登出后清除 cookie 跳转登录页', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // 通过 UI 真登录，拿一个本测试专属的 fresh session（不复用共享 token）
    await page.goto('/admin/login');
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('admin123');
    await page.getByRole('button', { name: '登录管理后台' }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });

    // Verify we are logged in (fresh session cookie)
    const cookiesBefore = await page.context().cookies();
    expect(cookiesBefore.some((c) => c.name === 'auth_token')).toBe(true);

    // The admin shell keeps its account actions in the sidebar footer.
    await page
      .getByTestId('admin-sidebar')
      .getByRole('button', { name: '退出登录' })
      .click();

    // Should redirect to homepage after logout (RootNav pushes to /)
    await expect(page).toHaveURL(/\//, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 5000 });

    // Cookie should be cleared
    const cookiesAfter = await page.context().cookies();
    const authToken = cookiesAfter.find((c) => c.name === 'auth_token');
    // Cookie should either not exist or be empty/expired
    expect(authToken === undefined || authToken.value === '').toBe(true);

    guard.report(testInfo);
  });
});

// ─── 注册页 (public pages) ────────────────────────────────────────

test.describe('注册页', () => {
  test('注册页：表单元素可见性', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');

    // Wait for Suspense to resolve
    await expect(page.getByPlaceholder('请输入账号（至少 3 个字符）')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('请输入密码（至少 6 个字符）')).toBeVisible();
    // 邀请码已改为可选字段
    await expect(page.getByPlaceholder('留空则注册为普通用户')).toBeVisible();

    // Submit button with "注册" text (Round B: 去掉了中间空格)
    await expect(page.getByRole('button', { name: '注册' })).toBeVisible();

    // Link to login page
    await expect(page.getByRole('link', { name: '前往登录' })).toBeVisible();

    guard.report(testInfo);
  });

  test('注册页：必填项为空提交显示校验', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');

    // Wait for form to render
    await expect(page.getByPlaceholder('请输入账号（至少 3 个字符）')).toBeVisible({ timeout: 10000 });

    // Click submit without filling any fields
    await page.getByRole('button', { name: '注册' }).click();

    // Client-side validation should show error message
    await expect(page.getByText('账号至少需要 3 个字符')).toBeVisible();

    guard.report(testInfo);
  });
});

// ─── 注册页表单校验（无 auth） ────────────────────────────────────

test.describe('注册页表单校验', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('账号少于3字符显示校验提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');
    await expect(page.getByPlaceholder('请输入账号（至少 3 个字符）')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号（至少 3 个字符）').fill('ab');
    await page.getByPlaceholder('请输入密码（至少 6 个字符）').fill('test123');
    await page.getByRole('button', { name: '注册' }).click();

    await expect(page.getByText('账号至少需要 3 个字符')).toBeVisible();

    guard.report(testInfo);
  });

  test('密码少于6字符显示校验提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');
    await expect(page.getByPlaceholder('请输入账号（至少 3 个字符）')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号（至少 3 个字符）').fill('testuser');
    await page.getByPlaceholder('请输入密码（至少 6 个字符）').fill('12345');
    await page.getByRole('button', { name: '注册' }).click();

    await expect(page.getByText('密码至少需要 6 个字符')).toBeVisible();

    guard.report(testInfo);
  });

  test('邀请码为可选字段——空邀请码可正常提交', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');
    await expect(page.getByPlaceholder('请输入账号（至少 3 个字符）')).toBeVisible({ timeout: 10000 });

    // Fill valid username and password, leave invitation code empty
    const timestamp = Date.now();
    await page.getByPlaceholder('请输入账号（至少 3 个字符）').fill(`e2e_reg_${timestamp}`);
    await page.getByPlaceholder('请输入密码（至少 6 个字符）').fill('test123456');
    // Leave invitation code empty — should NOT show validation error
    await page.getByRole('button', { name: '注册' }).click();

    // Should not show "邀请码不能为空" — invitation code is optional
    await expect(page.getByText('邀请码不能为空')).not.toBeVisible({ timeout: 3000 });

    guard.report(testInfo);
  });
});
