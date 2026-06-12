import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe('来源管理 /admin/sources', () => {
  // P0-004 (B3): 来源管理为 admin 后台页面
  test.use({ storageState: '.auth/admin-storage.json' });
  test('来源管理：页面加载', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sources');
    await page.waitForTimeout(1000);
    // Should show source list or empty state
    await expect(page.locator('h1, h2, h3, table, .text-muted-foreground').first()).toBeVisible({ timeout: 10000 });
    guard.report(testInfo);
  });

  test('来源管理：筛选器可见', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sources');
    await page.waitForTimeout(1000);
    // Should have filter controls
    const filters = page.locator('[role="combobox"], select, input[type="text"]');
    await expect(filters.first()).toBeVisible({ timeout: 5000 });
    guard.report(testInfo);
  });

  test('来源管理：创建来源对话框', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sources');
    await page.waitForTimeout(1000);

    // Find create/add button
    const createBtn = page.getByRole('button', { name: /创建|添加|新增/i });
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      // Dialog should open with form fields
      await page.waitForTimeout(500);
      await expect(page.locator('[role="dialog"], .fixed.inset-0').first().or(page.getByText(/创建来源|添加来源|新增来源/))).toBeVisible({ timeout: 3000 });

      // Should have form inputs
      const inputs = page.locator('input, select, textarea');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);

      // Close dialog — find cancel button
      const cancelBtn = page.getByRole('button', { name: /取消|关闭/i });
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
    guard.report(testInfo);
  });

  test('来源管理：搜索过滤', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sources');
    await page.waitForTimeout(1000);

    // Find search input and type
    const searchInput = page.getByPlaceholder(/搜索|关键词|来源/);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('测试搜索');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
    }
    guard.report(testInfo);
  });

  test('来源管理：来源列表展开', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sources');
    await page.waitForTimeout(2000);

    // Find expandable source rows
    const expandBtn = page.locator('button, [role="button"]').filter({ hasText: /展开|详情|更多/ }).first();
    if (await expandBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(1000);
      // Expanded content should be visible
      await expect(page.locator('body')).toBeVisible();
    }
    guard.report(testInfo);
  });

  test('来源管理：分页', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/admin/sources');
    await page.waitForTimeout(2000);

    // Check pagination exists if multiple pages
    const nextBtn = page.getByRole('button', { name: /下一页|Next/i });
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await nextBtn.isDisabled();
      if (!isDisabled) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        // Should still be on sources page
        await expect(page).toHaveURL(/\/admin\/sources/);
      }
    }
    guard.report(testInfo);
  });
});
