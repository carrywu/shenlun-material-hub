import { test, expect } from '@playwright/test';
import { loginAdminViaForm, TEST_ACCOUNTS } from './helpers/auth';
import { expectNoInfiniteLoading } from './helpers/assertions';

const ERROR_RE = /错误|失败|频繁|权限|再试/i;

test.describe('后台登录 /admin/login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('管理员登录成功', async ({ page }) => {
    await loginAdminViaForm(page);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expectNoInfiniteLoading(page);
  });

  test('错误密码提示', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    if (!page.url().includes('/admin/login')) { test.skip(); return; }
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('wrongpass');
    await page.getByRole('button', { name: '登录管理后台' }).click();
    await expect(page.getByText(ERROR_RE)).toBeVisible({ timeout: 10_000 });
  });

  test('未登录访问后台跳转', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
  });

  test('未登录访问后台子页面跳转', async ({ page }) => {
    for (const path of ['/admin/users', '/admin/sources', '/admin/logs']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/, { timeout: 5_000 });
    }
  });
});

test.describe('后台登出', () => {
  // Use empty storageState — create a fresh admin session for logout
  // so we don't destroy the shared admin.json session used by navigation/permission tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登出后不能访问后台', async ({ page }) => {
    // First log in with a fresh session
    await loginAdminViaForm(page);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

    const logoutBtn = page.locator('[title="退出登录"]').first();
    if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/$|\/login/, { timeout: 10_000 });
    }

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
  });
});
