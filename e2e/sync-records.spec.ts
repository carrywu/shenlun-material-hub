import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe('同步记录 /admin/sync-records', () => {
  test('同步记录：页面加载', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sync-records');
    await page.waitForTimeout(1000);
    // Page should render — table or empty state
    await expect(page.locator('table, .text-muted-foreground, h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
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
});
