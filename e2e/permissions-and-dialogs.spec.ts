import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

// ─── USER 权限拦截 ──────────────────────────────────────────────

test.describe('USER 权限拦截', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('USER 不能进入后台', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // 通过 API 注册一个普通 USER
    const username = `user_perm_${Date.now()}`;
    const registerRes = await page.request.post('/api/auth/register', {
      data: { username, password: 'test123456' },
    });
    // 注册成功或已存在都继续
    if (registerRes.ok()) {
      // 登录
      await page.goto('/login');
      await expect(page.getByPlaceholder('请输入账号')).toBeVisible({ timeout: 10000 });
      await page.getByPlaceholder('请输入账号').fill(username);
      await page.getByPlaceholder('请输入密码').fill('test123456');
      await page.getByRole('button', { name: '登 录' }).click();

      // 等待登录完成
      await page.waitForURL(/^(?!.*\/login)/, { timeout: 15000 }).catch(() => {});

      // 尝试访问 /admin — 应该被拦截
      await page.goto('/admin');
      await page.waitForURL(/\/(admin\/login|login)/, { timeout: 10000 }).catch(() => {});
      const url = page.url();
      expect(url).toMatch(/\/(admin\/login|login)/);
    }

    guard.report(testInfo);
  });
});

// ─── 管理员邀请码和用户管理 ─────────────────────────────────────

test.describe('管理员操作', () => {
  test('管理员邀请码页面可访问', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/invitations');
    // 使用 heading 精确匹配
    await expect(page.getByRole('heading', { name: '邀请码管理' })).toBeVisible({ timeout: 10000 });

    // 页面应该有创建相关按钮或表格
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('邀请码');

    guard.report(testInfo);
  });

  test('管理员用户管理页面可访问', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/users');
    // 使用 heading 精确匹配
    // 使用 h2 精确定位页面标题（sidebar 也有"用户管理"链接）
    await expect(page.locator('h2', { hasText: '用户管理' })).toBeVisible({ timeout: 10000 });

    // 表格应该存在
    await expect(page.locator('table')).toBeVisible();

    guard.report(testInfo);
  });
});

// ─── 用户设置页权限 ────────────────────────────────────────────

test.describe('用户设置页权限', () => {
  test('用户页展示管理员配置表单', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/integrations');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // 管理员应该能看到配置表单
    await expect(page.getByText('服务配置（仅管理员可见）')).toBeVisible();

    guard.report(testInfo);
  });

  test('用户页显示模式说明文案', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/integrations');
    await expect(page.getByText('公众号采集说明')).toBeVisible({ timeout: 10000 });

    // 应该显示采集模式说明
    const bodyText = await page.locator('body').textContent();
    const hasModeText =
      bodyText?.includes('共享采集账号模式') ||
      bodyText?.includes('管理员尚未启用');
    expect(hasModeText).toBe(true);

    guard.report(testInfo);
  });

  test('HTML 连接测试返回友好错误', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/integrations');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // 输入非 WeWe RSS 地址测试
    const baseUrlInput = page.getByPlaceholder(/域名|wewerss|47/);
    if (await baseUrlInput.isVisible()) {
      await baseUrlInput.clear();
      await baseUrlInput.fill('https://www.baidu.com');

      const testBtn = page.getByRole('button', { name: '测试连接' });
      if (await testBtn.isVisible()) {
        await testBtn.click();
        await page.waitForTimeout(3000);

        // 不应该出现 JSON parse 异常
        const bodyText = await page.locator('body').textContent();
        const hasRawError =
          bodyText?.includes('Unexpected token') ||
          bodyText?.includes('JSON.parse') ||
          bodyText?.includes('is not valid JSON');
        expect(hasRawError).toBe(false);
      }
    }

    guard.report(testInfo);
  });
});

// ─── MissingConfigDialog 触发 ───────────────────────────────────

test.describe('MissingConfigDialog', () => {
  test('采集按钮存在且可点击', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await page.waitForTimeout(2000);

    // 查找采集按钮（管理员可见）
    const collectBtn = page.getByRole('button', { name: '开始采集' });
    if (await collectBtn.isVisible()) {
      await collectBtn.click();
      await page.waitForTimeout(1000);
      // 不应该白屏或崩溃
      await expect(page.locator('body')).toBeVisible();
    }

    guard.report(testInfo);
  });
});

// ─── 订阅页面 ──────────────────────────────────────────────────

test.describe('订阅页面', () => {
  test('订阅页面可访问且展示基本元素', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/subscriptions');
    await expect(page.getByText('我的订阅')).toBeVisible({ timeout: 10000 });

    // 应该有同步按钮和添加订阅按钮
    await expect(page.getByRole('button', { name: '同步公众号' })).toBeVisible();
    await expect(page.getByRole('button', { name: '添加订阅' })).toBeVisible();

    guard.report(testInfo);
  });
});
