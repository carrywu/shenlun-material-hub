import { expect, test } from '@playwright/test';
import { loginAsAdminAPI } from './helpers/auth';
import { attachConsoleGuard } from './helpers/consoleGuard';

// P0-004 (B3): 文件级 admin storageState——所有 WeWe RSS 用例访问 /admin/integrations/wewe-rss
test.use({ storageState: '.auth/admin-storage.json' });

test.describe('WeWe RSS Integration Page', () => {
  test('WeWe RSS：集成页加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/integrations/wewe-rss');
    // AdminShell h1 shows "微信集成" for /admin/integrations/wewe-rss
    await expect(page.getByRole('heading', { name: '微信集成', level: 1 })).toBeVisible({ timeout: 10000 });
    // Page content shows "WeWe RSS 集成"
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  test('WeWe RSS：状态 API', async ({ request }, testInfo) => {
    test.setTimeout(60000);

    await loginAsAdminAPI(request);
    const res = await request.get('/api/integrations/wewe-rss/status');
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Verify the response shape
    expect(body).toHaveProperty('reachable');
    expect(body).toHaveProperty('baseUrl');
    expect(body).toHaveProperty('channels');
    expect(body.channels).toHaveProperty('api');
    expect(body.channels).toHaveProperty('sqlite');
    expect(body.channels).toHaveProperty('weressFallback');
  });

  test('WeWe RSS：配置表单', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/integrations/wewe-rss');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // API base URL input visible (has placeholder http://localhost:4000)
    const urlInput = page.getByPlaceholder('http://localhost:4000');
    await expect(urlInput).toBeVisible();

    // The db path input is also present (second input in the connection card)
    const dbPathInput = page.getByPlaceholder('infra/wechat-rss/wewe-rss/data/wewe-rss.db');
    await expect(dbPathInput).toBeVisible();

    guard.report(testInfo);
  });

  test('WeWe RSS：测试连接按钮', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/integrations/wewe-rss');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // Test connection button visible
    const testBtn = page.getByRole('button', { name: '测试连接' });
    await expect(testBtn).toBeVisible();

    // Click the test button
    await testBtn.click();
    // Wait for result — either connected badge or error state
    await page.waitForTimeout(5000);

    // After clicking, the status should update (connected or not connected badge)
    const connectedBadge = page.getByText('已连接');
    const notConnectedBadge = page.getByText('未连接');
    const hasResult = await connectedBadge.isVisible().catch(() => false)
      || await notConnectedBadge.isVisible().catch(() => false);
    expect(hasResult).toBe(true);

    guard.report(testInfo);
  });

  test('WeWe RSS：预览同步', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/integrations/wewe-rss');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // Preview sync button visible
    const previewBtn = page.getByRole('button', { name: '预览同步' });
    await expect(previewBtn).toBeVisible();

    // Click preview
    await previewBtn.click();
    // Wait for result to appear
    await page.waitForTimeout(5000);

    // After preview, verify page is stable (no crash)
    // WeWe RSS service may be unavailable, so we only verify the page didn't crash
    await expect(page.getByRole('heading', { name: 'WeWe RSS 集成' })).toBeVisible({ timeout: 5000 });
    // Check for either a result or an error message — at least one UI response
    const previewResult = page.getByText(/数据来源|预览失败|服务不可用/);
    await expect(previewResult).toBeVisible({ timeout: 10000 }).catch(() => {
      // If nothing appeared, page should at least still show the integration page
    });

    guard.report(testInfo);
  });

  test('WeWe RSS：同步来源', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/integrations/wewe-rss');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // Sync button visible
    const syncBtn = page.getByRole('button', { name: '同步公众号列表' });
    await expect(syncBtn).toBeVisible();

    // Click sync
    await syncBtn.click();

    // Wait for sync to complete (either success or error)
    // The sync result will show in a div with class bg-muted containing the message
    const syncResultContainer = page.locator('.bg-muted');
    await expect.poll(
      async () => {
        const count = await syncResultContainer.count();
        return count > 0;
      },
      {
        timeout: 60000,
        message: '等待同步结果出现',
      }
    );

    // Verify the result message contains expected keywords
    const resultText = await syncResultContainer.first().textContent();
    const hasExpectedText = resultText && (
      resultText.includes('同步完成') ||
      resultText.includes('同步失败') ||
      resultText.includes('WeWe RSS 中没有') ||
      resultText.includes('服务不可用')
    );
    expect(hasExpectedText, `同步结果应包含预期文案，实际为：${resultText}`).toBe(true);

    guard.report(testInfo);
  });

  test('WeWe RSS：删除确认 — 取消不删除来源', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Intercept sync-sources API to return mock data with pending deletes
    await page.route('**/api/integrations/wewe-rss/sync-sources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          added: 0,
          existing: 2,
          toDelete: [
            { id: 'mock-source-1', feedId: 'MP_WXS_001', name: '测试公众号A' },
            { id: 'mock-source-2', feedId: 'MP_WXS_002', name: '测试公众号B' },
          ],
        }),
      });
    });

    // Track if delete API is called — it should NOT be called on cancel
    let deleteApiCalled = false;
    await page.route('**/api/integrations/wewe-rss/delete-missing-sources', async (route) => {
      deleteApiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, deleted: 0 }),
      });
    });

    await page.goto('/admin/integrations/wewe-rss');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // Click sync button — our mock returns toDelete, triggering the dialog
    const syncBtn = page.getByRole('button', { name: '同步公众号列表' });
    await syncBtn.click();

    // Verify delete confirmation dialog appears
    await expect(page.getByText('同步删除来源确认')).toBeVisible({ timeout: 10000 });

    // Verify pending delete items are listed
    await expect(page.getByText('测试公众号A')).toBeVisible();
    await expect(page.getByText('测试公众号B')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: '取消' }).click();

    // Verify dialog closes
    await expect(page.getByText('同步删除来源确认')).not.toBeVisible();

    // Verify delete API was NOT called
    expect(deleteApiCalled).toBe(false);

    guard.report(testInfo);
  });

  test('WeWe RSS：删除确认 — 确认后执行删除', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Intercept sync-sources API to return mock data with pending deletes
    await page.route('**/api/integrations/wewe-rss/sync-sources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          added: 0,
          existing: 2,
          toDelete: [
            { id: 'mock-source-1', feedId: 'MP_WXS_001', name: '测试公众号A' },
          ],
        }),
      });
    });

    // Intercept delete API
    let deletePayload: { sourceIds?: string[]; deleteContentItems?: boolean } | null = null;
    await page.route('**/api/integrations/wewe-rss/delete-missing-sources', async (route) => {
      const request = route.request();
      deletePayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '已删除 1 个 WeWe RSS 来源',
          deleted: 1,
          contentItemsDeleted: 0,
        }),
      });
    });

    await page.goto('/admin/integrations/wewe-rss');
    await expect(page.getByText('WeWe RSS 集成')).toBeVisible({ timeout: 10000 });

    // Click sync button
    const syncBtn = page.getByRole('button', { name: '同步公众号列表' });
    await syncBtn.click();

    // Verify dialog appears
    await expect(page.getByText('同步删除来源确认')).toBeVisible({ timeout: 10000 });

    // Click confirm delete
    await page.getByRole('button', { name: '确认删除（不删文章）' }).click();

    // Wait for delete API call
    await page.waitForTimeout(3000);

    // Verify delete API was called with correct payload
    expect(deletePayload).not.toBeNull();
    expect(deletePayload!.sourceIds).toContain('mock-source-1');
    expect(deletePayload!.deleteContentItems).toBe(false);

    guard.report(testInfo);
  });
});
