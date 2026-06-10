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
    await expect(page.getByRole('heading', { name: '申论素材采集台' })).toBeVisible();

    guard.report(testInfo);
  });

  test('登录页：表单元素可见性', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/login');

    // Suspense wrapper means we wait for placeholders to appear
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登 录' })).toBeVisible();

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
    await page.getByRole('button', { name: '登 录' }).click();

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
    await page.getByRole('button', { name: '登 录' }).click();

    // Should land on /admin (the redirect target)
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: '系统概览' })).toBeVisible();

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
    await page.getByRole('button', { name: '登 录' }).click();

    // Without redirect param, should go to homepage /
    await expect(page).toHaveURL(/^(?!.*\/admin\/login).*$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\//, { timeout: 5000 });

    guard.report(testInfo);
  });
});

// ─── 导航 (authenticated via global storageState) ──────────────────

test.describe('导航（已认证）', () => {
  test('登录页：已登录用户访问登录页跳转首页', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Already authenticated via global storageState
    // Now try to visit login page
    await page.goto('/admin/login');

    // Should be redirected to /
    await expect(page).toHaveURL(/^\//, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/admin\/login/);

    guard.report(testInfo);
  });

  test('导航：登录后顶部导航栏可见', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Check all main nav links in header
    await expect(page.getByRole('link', { name: '仪表板' })).toBeVisible();
    await expect(page.getByRole('link', { name: '今日推荐' })).toBeVisible();
    await expect(page.getByRole('link', { name: '探索区' })).toBeVisible();
    await expect(page.getByRole('link', { name: '文章列表' })).toBeVisible();
    await expect(page.getByRole('link', { name: '素材卡' })).toBeVisible();
    await expect(page.getByRole('link', { name: '检索' })).toBeVisible();
    await expect(page.getByRole('link', { name: '复习' })).toBeVisible();
    await expect(page.getByRole('link', { name: '设置' })).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：admin 用户可见管理后台入口', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await expect(page.getByRole('link', { name: '管理后台' })).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：顶部导航链接可点击跳转', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Click 文章列表
    await page.getByRole('link', { name: '文章列表' }).click();
    await expect(page).toHaveURL(/\/articles/, { timeout: 10000 });
    // Verify page loaded (not blank)
    await expect(page.locator('body')).toBeVisible();

    // Click 素材卡
    await page.getByRole('link', { name: '素材卡' }).click();
    await expect(page).toHaveURL(/\/cards/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();

    guard.report(testInfo);
  });

  test('导航：管理后台侧边栏可见', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Navigate to admin area
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '系统概览' })).toBeVisible({ timeout: 10000 });

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

    // Click 异步任务
    await page.getByRole('link', { name: '异步任务' }).click();
    await expect(page).toHaveURL(/\/admin\/tasks/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: '异步任务' })).toBeVisible();

    // Click 系统日志
    await page.getByRole('link', { name: '系统日志' }).click();
    await expect(page).toHaveURL(/\/admin\/logs/, { timeout: 10000 });

    guard.report(testInfo);
  });

  test('导航：侧边栏折叠', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '系统概览' })).toBeVisible({ timeout: 10000 });

    // Find the sidebar and capture its width before collapsing
    const sidebar = page.locator('aside, nav, [data-sidebar]').first();
    const widthBefore = await sidebar.evaluate((el) => el.getBoundingClientRect().width);

    // Click collapse toggle button
    const collapseBtn = page.getByRole('button', { name: /折叠|收起|collapse/i });
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();

      // Sidebar should be narrower
      const widthAfter = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      expect(widthAfter).toBeLessThan(widthBefore);

      // Click again to restore
      await collapseBtn.click();
      const widthRestored = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      expect(widthRestored).toBeGreaterThan(widthAfter);
    }

    guard.report(testInfo);
  });
});

// ─── 登出 (authenticated via global storageState) ──────────────────

test.describe('登出（已认证）', () => {
  test('登出：点击登出后清除 cookie 跳转登录页', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Already authenticated via global storageState
    // Verify we are logged in
    const cookiesBefore = await page.context().cookies();
    expect(cookiesBefore.some((c) => c.name === 'auth_token')).toBe(true);

    // Click logout button in the nav/header
    await page.getByRole('button', { name: /登出|退出/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 });

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
    await expect(page.getByPlaceholder('请输入账号（数字或英文字母）')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('请输入密码（至少 6 个字符）')).toBeVisible();
    await expect(page.getByPlaceholder('请输入邀请码')).toBeVisible();

    // Submit button with "注 册" text
    await expect(page.getByRole('button', { name: '注 册' })).toBeVisible();

    // Link to login page
    await expect(page.getByRole('link', { name: '前往登录' })).toBeVisible();

    guard.report(testInfo);
  });

  test('注册页：必填项为空提交显示校验', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');

    // Wait for form to render
    await expect(page.getByPlaceholder('请输入账号（数字或英文字母）')).toBeVisible({ timeout: 10000 });

    // Click submit without filling any fields
    await page.getByRole('button', { name: '注 册' }).click();

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
    await expect(page.getByPlaceholder('请输入账号（数字或英文字母）')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号（数字或英文字母）').fill('ab');
    await page.getByPlaceholder('请输入密码（至少 6 个字符）').fill('test123');
    await page.getByPlaceholder('请输入邀请码').fill('test');
    await page.getByRole('button', { name: '注 册' }).click();

    await expect(page.getByText('账号至少需要 3 个字符')).toBeVisible();

    guard.report(testInfo);
  });

  test('密码少于6字符显示校验提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');
    await expect(page.getByPlaceholder('请输入账号（数字或英文字母）')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号（数字或英文字母）').fill('testuser');
    await page.getByPlaceholder('请输入密码（至少 6 个字符）').fill('12345');
    await page.getByPlaceholder('请输入邀请码').fill('test');
    await page.getByRole('button', { name: '注 册' }).click();

    await expect(page.getByText('密码至少需要 6 个字符')).toBeVisible();

    guard.report(testInfo);
  });

  test('邀请码为空显示校验提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/register');
    await expect(page.getByPlaceholder('请输入账号（数字或英文字母）')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('请输入账号（数字或英文字母）').fill('testuser');
    await page.getByPlaceholder('请输入密码（至少 6 个字符）').fill('test123');
    // Leave invitation code empty
    await page.getByRole('button', { name: '注 册' }).click();

    await expect(page.getByText('邀请码不能为空')).toBeVisible();

    guard.report(testInfo);
  });
});
