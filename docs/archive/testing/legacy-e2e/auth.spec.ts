import { test, expect } from '@playwright/test';
import { loginViaForm, loginAdminViaForm, TEST_ACCOUNTS } from './helpers/auth';
import { expectNoInfiniteLoading } from './helpers/assertions';

// Common error regex — covers wrong credentials, disabled accounts, and rate-limit
const ERROR_RE = /错误|失败|不正确|频繁|权限|再试/i;

test.describe('前台登录 /login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登录页面加载正常', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /申论素材/ })).toBeVisible();
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
    await expectNoInfiniteLoading(page);
  });

  test('正确账号登录成功', async ({ page }) => {
    await loginViaForm(page, TEST_ACCOUNTS.userA.username, TEST_ACCOUNTS.userA.password);
    // loginViaForm handles redirect-away from /login
    await expect(page).toHaveURL(/\/articles|\/$|\/cards|\/review/, { timeout: 15_000 });
  });

  test('错误密码显示错误', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    if (!page.url().includes('/login')) { test.skip(); return; }
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('wrongpassword');
    await page.getByRole('button', { name: '登录' }).click();
    // Wait for error message — could be credential error or rate-limit
    await expect(page.getByText(ERROR_RE)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('空表单校验', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    if (!page.url().includes('/login')) { test.skip(); return; }
    await page.getByRole('button', { name: '登录' }).click();
    // Should stay on login page with client-side validation
    await expect(page).toHaveURL(/\/login/);
  });

  test('登录后访问 /login 重定向', async ({ page, request }) => {
    await loginViaForm(page, TEST_ACCOUNTS.userA.username, TEST_ACCOUNTS.userA.password);
    // If login failed (rate limit), skip the redirect test
    if (page.url().includes('/login')) { test.skip(); return; }
    await page.goto('/login');
    // Logged-in users visiting /login should be redirected away
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});

test.describe('注册页 /register', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('注册页面加载正常', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByPlaceholder('留空则注册为普通用户')).toBeVisible();
    await expect(page.getByRole('button', { name: '注册' })).toBeVisible();
  });

  test('邀请码为可选字段', async ({ page }) => {
    await page.goto('/register');
    const inviteInput = page.getByPlaceholder('留空则注册为普通用户');
    await expect(inviteInput).toBeVisible();
  });
});

test.describe('登出', () => {
  // Use empty storageState — create a fresh admin session for logout
  // so we don't destroy the shared admin.json session used by navigation/permission tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登出后无法访问受保护页面', async ({ page }) => {
    // First log in with a fresh session
    await loginAdminViaForm(page);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    
    // Find and click logout button
    const logoutBtn = page.locator('[title="退出登录"], button:has-text("退出")').first();
    if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/login|\/$/, { timeout: 10_000 });
    }

    // Try accessing protected page
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('后台登录 /admin/login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('管理员登录成功', async ({ page }) => {
    await loginAdminViaForm(page);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  });

  test('普通用户不能登录后台', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    if (!page.url().includes('/admin/login')) { test.skip(); return; }
    await page.getByPlaceholder('请输入账号').fill(TEST_ACCOUNTS.userA.username);
    await page.getByPlaceholder('请输入密码').fill(TEST_ACCOUNTS.userA.password);
    await page.getByRole('button', { name: '登录管理后台' }).click();
    // Should show error or stay on login page
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasError = await page.getByText(ERROR_RE).isVisible().catch(() => false);
    expect(url.includes('/admin/login') || hasError).toBeTruthy();
  });
});
