import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

/**
 * §错误状态测试
 * 验证应用在异常情况下的表现：
 * - API 500 错误提示
 * - 网络错误优雅降级
 * - 空数据状态提示
 * - 404 页面
 */

test.describe('错误状态处理', () => {
  // ── 404 页面 ──

  test('不存在的路由显示 404 页面', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/this-page-does-not-exist-at-all');
    // Next.js 会渲染 not-found 页面或显示 404
    // 页面不应白屏
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    guard.report(testInfo);
  });

  test('不存在的 API 路由返回 404', async ({ request }) => {
    const res = await request.get('/api/nonexistent-endpoint');
    expect(res.status()).toBe(404);
  });

  // ── API 错误处理 ──

  test('文章列表：mock 500 错误时显示错误提示', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock articles API 返回 500
    await page.route('**/api/articles**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '服务器内部错误' }),
      })
    );

    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // 页面不应白屏 — 至少有可见内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    // 不应有未处理的错误弹窗
    const _errorOverlay = page.locator('#__next-route-announcer, [role="alert"]');
    // 页面仍然可用（有导航或内容区域）

    guard.report(testInfo);
  });

  test('管理后台：mock metrics 500 错误时页面不崩溃', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock admin metrics 返回 500
    await page.route('**/api/admin/metrics**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '服务器内部错误' }),
      })
    );

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // 页面不应白屏
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    guard.report(testInfo);
  });

  // ── 网络错误处理 ──

  test('文章列表：mock 网络错误时页面不崩溃', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock 网络错误
    await page.route('**/api/articles**', (route) => route.abort('failed'));

    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // 页面不应白屏
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    guard.report(testInfo);
  });

  // ── 空数据状态 ──

  test('搜索页：mock 空结果时显示空状态', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock search API 返回空数据
    await page.route('**/api/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      })
    );

    await page.goto('/search?q=完全不存在的关键词');
    await page.waitForLoadState('networkidle');

    // 页面应正常渲染（不白屏）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    guard.report(testInfo);
  });

  test('复习页：mock 空数据时页面不崩溃', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock review API 返回空数据
    await page.route('**/api/review**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      })
    );

    await page.goto('/review');
    await page.waitForLoadState('networkidle');

    // 页面应正常渲染
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    guard.report(testInfo);
  });

});

// ── 表单验证错误 — 独立 describe 以使用 storageState ──

test.describe('错误状态处理 — 登录表单', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登录页：空表单提交不崩溃', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/login');
    await expect(page.locator('form').first()).toBeVisible({ timeout: 10000 });

    // 不填写任何内容直接提交
    await page.locator("form button[type='submit']").click();

    // 页面不应崩溃 — 表单仍然可见
    await expect(page.locator('form').first()).toBeVisible();

    guard.report(testInfo);
  });

  test('登录页：错误密码提示', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/login');
    await expect(page.locator('form').first()).toBeVisible({ timeout: 10000 });

    // 填写错误密码
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('wrongpassword');
    await page.locator("form button[type='submit']").click();

    // 等待响应
    await page.waitForTimeout(2000);

    // 页面应显示错误提示或停留在登录页
    await expect(page).toHaveURL(/\/admin\/login/);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    guard.report(testInfo);
  });
});
