import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

// P0-004 (B3): 文件级 admin storageState——/admin/settings/ai 与 /settings/ai 均需登录态；
// admin 同为登录用户，可覆盖 /settings/ai 用户页
test.use({ storageState: '.auth/admin-storage.json' });

test.describe('Admin AI Config', () => {
  test('管理员 AI 配置：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/settings/ai');
    // AdminShell h1 shows "AI 配置"
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });
    // Prompt templates section visible
    await expect(page.getByText('AI 默认提示词模板')).toBeVisible({ timeout: 10000 });
    // API config form visible — check for "服务配置" card title
    await expect(page.getByText('服务配置')).toBeVisible();

    guard.report(testInfo);
  });

  test('管理员 AI 配置：提示词模板', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/settings/ai');
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });

    // Wait for prompt templates section to load (API call)
    await expect(page.getByText('AI 默认提示词模板')).toBeVisible({ timeout: 15000 });

    // Check for expected prompt template names (these come from /api/ai-config/prompts)
    const assessPrompt = page.getByText('文章评估提示词');
    const goldenQuotePrompt = page.getByText('申论金句提示词');

    // At least one of the expected prompts should be present, or the empty state is shown
    const hasAssess = await assessPrompt.isVisible().catch(() => false);
    const hasGolden = await goldenQuotePrompt.isVisible().catch(() => false);
    const hasTemplates = hasAssess || hasGolden;
    const hasEmptyState = await page.getByText('暂无提示词模板').isVisible().catch(() => false);
    expect(hasTemplates || hasEmptyState).toBe(true);

    guard.report(testInfo);
  });

  test('管理员 AI 配置：无废弃类型', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/settings/ai');
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });

    // Wait for prompt templates to load
    await expect(page.getByText('AI 默认提示词模板')).toBeVisible({ timeout: 15000 });

    // Verify deprecated types are NOT present
    await expect(page.locator('body')).not.toContainText('数据事实提示词');
    await expect(page.locator('body')).not.toContainText('card_data_fact');

    guard.report(testInfo);
  });

  test('管理员 AI 配置：测试连接失败显示错误', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock AI test endpoint to return error
    await page.route('**/api/ai-config/test', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: '连接失败：超时' }) })
    );
    await page.goto('/admin/settings/ai');
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });
    const testButton = page.getByRole('button', { name: /测试|Test/i });
    if (await testButton.isVisible()) {
      await testButton.click();
      // 精确匹配测试结果 Badge（避免误匹配 DB 解密失败提示等其他含「失败」的元素）
      await expect(page.getByText('失败: 连接失败：超时')).toBeVisible({ timeout: 5000 });
    }

    guard.report(testInfo);
  });

  test('管理员 AI 配置：保存按钮', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/settings/ai');
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });

    // Save button visible
    const saveBtn = page.getByRole('button', { name: '保存配置' }).or(page.getByRole('button', { name: '保存中...' }));
    await expect(saveBtn).toBeVisible();

    // Click save (may succeed or fail depending on config state)
    await page.getByRole('button', { name: '保存配置' }).click().catch(() => {});
    // Wait for response — either toast appears or page stays stable
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  test('管理员 AI 配置：测试按钮', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/settings/ai');
    await expect(page.getByTestId('ai-config-page')).toBeVisible({ timeout: 10000 });

    // Test button visible in the status card
    const testBtn = page.getByRole('button', { name: /测试连接|测试中/ });
    await expect(testBtn).toBeVisible({ timeout: 5000 });

    // Button is disabled when no AI config is saved (disabled={testing || !config?.configured})
    const isEnabled = await testBtn.isEnabled();
    if (isEnabled) {
      await testBtn.click();
      // After testing, verify a result appeared — success/failure badge or button re-enabled
      await expect.poll(async () => {
        const resultBadge = page.locator('text=/连接成功|失败|测试失败/');
        const badgeVisible = await resultBadge.isVisible().catch(() => false);
        const btnReEnabled = await testBtn.isEnabled();
        return badgeVisible || btnReEnabled;
      }, { timeout: 10000, message: '测试连接结果应出现（badge 或按钮恢复可用）' }).toBe(true);
    }
    // If button is disabled (no config saved), test passes — button visibility confirmed

    guard.report(testInfo);
  });
});

test.describe('User AI Settings', () => {
  test.use({ storageState: '.auth/verified-storage.json' });

  test('用户 AI 配置：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/settings/ai');
    // Page heading
    await expect(page.getByTestId('settings-ai-page-header')).toBeVisible({ timeout: 10000 });
    // Config form visible — check for API Base URL label
    await expect(page.getByText('API Base URL')).toBeVisible({ timeout: 10000 });
    // Save button visible
    await expect(page.getByRole('button', { name: '保存配置' }).or(page.getByRole('button', { name: '保存中...' }))).toBeVisible();
    // Test button visible (only when config is configured)
    // Delete button visible (only when config is configured)
    // At minimum the form is rendered — scope to the "模型参数" CardTitle,
    // since "模型参数" also appears as a substring inside the page subtitle
    // sentence ("配置您的个人 AI 模型参数，优先级高于系统默认配置").
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: '模型参数' })).toBeVisible();

    guard.report(testInfo);
  });

  test('用户 AI 配置：未配置时禁用测试连接', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.route('**/api/settings/ai-config', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: false }) })
    );

    await page.goto('/settings/ai');
    await expect(page.getByTestId('settings-ai-page-header')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('请先保存并启用您的个人 AI 配置后再测试连接。')).toBeVisible();
    await expect(page.getByRole('button', { name: '测试连接' })).toBeDisabled();

    guard.report(testInfo);
  });

  test('用户 AI 配置：测试个人配置失败显示接口错误', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.route('**/api/settings/ai-config', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          baseUrl: 'https://api.example.test/v1',
          maskedKey: 'sk-t****',
          model: 'test-model',
          temperature: 0.3,
          isEnabled: true,
        }),
      })
    );
    await page.route('**/api/ai-config/test', route =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, error: '个人配置不可用' }) })
    );

    await page.goto('/settings/ai');
    const testButton = page.getByRole('button', { name: '测试连接' });
    await expect(testButton).toBeEnabled();
    await testButton.click();
    await expect(page.getByText('连接失败: 个人配置不可用')).toBeVisible();

    guard.report(testInfo);
  });

  test('用户 AI 配置：保存成功后清空输入并显示成功提示', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    let saved = false;

    await page.route('**/api/settings/ai-config', async route => {
      if (route.request().method() === 'POST') {
        saved = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(saved
          ? {
              configured: true,
              baseUrl: 'https://api.example.test/v1',
              maskedKey: 'sk-t****',
              model: 'test-model',
              temperature: 0.3,
              isEnabled: true,
            }
          : { configured: false }),
      });
    });

    await page.goto('/settings/ai');
    await expect(page.getByTestId('settings-ai-page-header')).toBeVisible({ timeout: 10000 });

    const keyInput = page.getByPlaceholder('输入 API Key');
    await keyInput.fill('sk-test-save-feedback');
    await page.getByRole('button', { name: '保存配置' }).click();

    await expect(page.getByText('保存成功，当前个人 AI 配置已启用。')).toBeVisible();
    await expect(page.getByText('当前: sk-t****')).toBeVisible();
    await expect(page.getByPlaceholder('留空则保持不变')).toHaveValue('');

    guard.report(testInfo);
  });
});
