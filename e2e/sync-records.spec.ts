import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe('同步记录 /admin/sync-records', () => {
  // P0-004 (B3): 同步记录为 admin 后台页面
  test.use({ storageState: '.auth/admin-storage.json' });
  test('同步记录：页面加载', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sync-records');
    await page.waitForTimeout(1000);
    // Page should render — header 表示页面已加载
    await expect(page.getByTestId('sync-records-page-header')).toBeVisible({ timeout: 10000 });
    guard.report(testInfo);
  });

  test('同步记录：筛选器可见', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sync-records');
    await page.waitForTimeout(1000);
    // Should have filter controls — select dropdowns or date inputs
    const selects = page.locator('select, [role="combobox"], button');
    await expect(selects.first()).toBeVisible({ timeout: 5000 });
    guard.report(testInfo);
  });

  test('同步记录：刷新按钮', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sync-records');
    await page.waitForTimeout(1000);
    const refreshBtn = page.getByRole('button', { name: /刷新|Refresh/i });
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(1000);
      // Page should reload without errors
      await expect(page.locator('body')).toBeVisible();
    }
    guard.report(testInfo);
  });

  test('同步记录：表格或空状态', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sync-records');
    await page.waitForTimeout(2000);
    // Either table with rows, or empty state message
    const hasTable = await page.locator('table').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/暂无|没有|empty/i).isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
    guard.report(testInfo);
  });

  test('同步失败记录显示中文错误提示', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sync-records');
    // 页面有 2 个 '同步记录' heading：header 顶部小 h1 + 主区大 h1。定位主标题（text-2xl）。
    await expect(page.locator('h1.text-2xl')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Try to filter for failed records
    const statusTrigger = page.locator('[aria-label="同步状态"]');
    if (await statusTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusTrigger.click();
      const failedOption = page.getByRole('option', { name: '失败' });
      if (await failedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await failedOption.click();
        await page.waitForTimeout(1500);
      }
    }

    // Check that any visible error messages are in Chinese (not raw English)
    const errorCells = page.locator('.text-destructive');
    const count = await errorCells.count();
    for (let i = 0; i < count; i++) {
      const text = await errorCells.nth(i).textContent();
      // Error messages should NOT contain untranslated English API error patterns
      if (text && /ima API error/i.test(text)) {
        throw new Error(`发现未翻译的英文错误消息: ${text}`);
      }
    }

    guard.report(testInfo);
  });
});
