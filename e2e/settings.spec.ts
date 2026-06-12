import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

// P0-004 (B3): 文件级 admin storageState——设置/账号/IMA 均为用户页需登录态；
// admin 同为登录用户可覆盖
test.use({ storageState: '.auth/admin-storage.json' });

test.describe('设置首页', () => {
  test('设置首页：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings$/);

    // Verify page heading
    await expect(page.getByRole('heading', { name: '个人设置' })).toBeVisible();

    // Verify links to sub-pages are visible
    await expect(page.getByRole('link', { name: /账号设置/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /AI 配置/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /IMA 知识库/ })).toBeVisible();

    guard.report(testInfo);
  });

  test('设置首页：点击链接跳转', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings');

    // Click "账号设置" link
    await page.getByRole('link', { name: /账号设置/ }).click();
    await expect(page).toHaveURL(/\/settings\/account$/, { timeout: 10000 });

    // Click the back arrow link to return to /settings
    const backLink = page.locator('a[href="/settings"]').first();
    await backLink.click();
    await expect(page).toHaveURL(/\/settings$/);

    guard.report(testInfo);
  });
});

test.describe('账号设置', () => {
  test('账号设置：表单可见', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/account');
    await expect(page).toHaveURL(/\/settings\/account$/);

    // Verify page heading
    await expect(page.getByRole('heading', { name: '账号设置' })).toBeVisible();

    // Verify form fields are present
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // Submit button should be visible
    await expect(page.getByRole('button', { name: '修改密码' })).toBeVisible();

    guard.report(testInfo);
  });

  test('账号设置：空密码提交校验', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/account');
    await expect(page.locator('#currentPassword')).toBeVisible();

    // Click submit without filling any fields
    await page.getByRole('button', { name: '修改密码' }).click();

    // Client-side validation should show an error message
    await expect(page.getByText('请填写所有字段')).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });

  test('账号设置：新密码为空提交显示校验', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/account');
    await expect(page.locator('#currentPassword')).toBeVisible();

    // Fill only current password, leave new password empty
    await page.getByPlaceholder('请输入当前密码').fill('admin123');
    await page.getByRole('button', { name: '修改密码' }).click();

    // Should show validation error (all fields required)
    // 精确匹配错误文案——宽正则会命中 label（当前密码/新密码 等）
    await expect(page.getByText('请填写所有字段')).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });
});

test.describe('IMA 设置', () => {
  test('IMA 设置：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/ima');
    await expect(page).toHaveURL(/\/settings\/ima$/);

    // Verify page heading
    await expect(page.getByRole('heading', { name: 'IMA 知识库' })).toBeVisible();

    // Either target list or the add button should be visible
    const addTargetButton = page.getByRole('button', { name: '添加 IMA 目标' });
    const targetList = page.getByText('已配置的目标');
    await expect(addTargetButton.or(targetList)).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  test('IMA 设置：添加表单交互', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/ima');

    await expect(page.getByRole('heading', { name: 'IMA 知识库' })).toBeVisible();

    // If targets exist and the "添加 IMA 目标" button is not visible,
    // the form may already be showing. Wait for either state.
    const addTargetButton = page.getByRole('button', { name: '添加 IMA 目标' });

    // Click add button to open form
    await expect(addTargetButton).toBeVisible({ timeout: 10000 });
    await addTargetButton.click();

    // Verify form appears with 5 inputs
    await expect(page.getByPlaceholder('如：我的 IMA 知识库')).toBeVisible();
    await expect(page.getByPlaceholder('https://api.ima.qq.com')).toBeVisible();
    await expect(page.getByPlaceholder('您的 Client ID')).toBeVisible();
    await expect(page.getByPlaceholder('您的 API Key')).toBeVisible();
    await expect(page.getByPlaceholder('目标知识库 ID')).toBeVisible();

    // Verify create and cancel buttons
    await expect(page.getByRole('button', { name: '创建' })).toBeVisible();
    const cancelButton = page.getByRole('button', { name: '取消' });
    await expect(cancelButton).toBeVisible();

    // Click cancel to hide form
    await cancelButton.click();

    // Form should be hidden, add button should be back
    await expect(addTargetButton).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('如：我的 IMA 知识库')).not.toBeVisible();

    guard.report(testInfo);
  });
});
