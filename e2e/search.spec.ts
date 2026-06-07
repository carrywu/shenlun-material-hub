import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe('搜索页', () => {
  test('搜索页：页面加载', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');
    await expect(page).toHaveURL(/\/search$/);

    // Verify key elements are visible
    await expect(page.getByPlaceholder('输入关键词搜索素材卡...')).toBeVisible();
    await expect(page.getByRole('button', { name: '搜索' })).toBeVisible();
    // Page title
    await expect(page.getByRole('heading', { name: '素材卡检索' })).toBeVisible();

    guard.report(testInfo);
  });

  test('搜索页：输入关键词搜索', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');

    // Fill search input and click search
    await page.getByPlaceholder('输入关键词搜索素材卡...').fill('测试');
    await page.getByRole('button', { name: '搜索' }).click();

    // Wait for results or empty state to appear
    await expect(
      page.getByText('共找到').or(page.getByText('未找到匹配的素材卡'))
    ).toBeVisible({ timeout: 15000 });

    guard.report(testInfo);
  });

  test('搜索页：无结果显示空状态', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');

    // Search for something that should not exist
    await page.getByPlaceholder('输入关键词搜索素材卡...').fill('不存在的关键词xyz123');
    await page.getByRole('button', { name: '搜索' }).click();

    // Empty state should be visible
    await expect(page.getByText('未找到匹配的素材卡')).toBeVisible({ timeout: 15000 });

    guard.report(testInfo);
  });

  test('搜索页：卡片类型筛选', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');

    // Click the card type select trigger
    const cardTypeSelect = page.locator('button:has(> span:has-text("全部类型"))').first();
    await cardTypeSelect.click();

    // Options should appear in the dropdown
    await expect(page.getByRole('option', { name: '申论金句' })).toBeVisible();
    await expect(page.getByRole('option', { name: '案例素材' })).toBeVisible();

    guard.report(testInfo);
  });

  test('搜索页：确认状态筛选', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');

    // Click the confirmed status select trigger
    const confirmedSelect = page.locator('button:has(> span:has-text("全部状态"))').first();
    await confirmedSelect.click();

    // Options should appear
    await expect(page.getByRole('option', { name: '已确认' })).toBeVisible();
    await expect(page.getByRole('option', { name: '未确认' })).toBeVisible();

    guard.report(testInfo);
  });

  test('搜索页：清除筛选', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');

    // Set up filters: fill query, select a card type
    const searchInput = page.getByPlaceholder('输入关键词搜索素材卡...');
    await searchInput.fill('测试');

    // Select a card type
    const cardTypeSelect = page.locator('button:has(> span:has-text("全部类型"))').first();
    await cardTypeSelect.click();
    await page.getByRole('option', { name: '申论金句' }).click();

    // Verify filter badge appeared
    await expect(page.getByText('类型: 申论金句')).toBeVisible();

    // Click the "清除筛选" button
    await page.getByRole('button', { name: '清除筛选' }).click();

    // Verify filters are reset: search input empty, no filter badges
    await expect(searchInput).toHaveValue('');
    await expect(page.getByText('类型: 申论金句')).not.toBeVisible();

    guard.report(testInfo);
  });

  test('搜索页：点击结果卡片跳转', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/search');

    // Search for a common term that is likely to have results
    await page.getByPlaceholder('输入关键词搜索素材卡...').fill('的');
    await page.getByRole('button', { name: '搜索' }).click();

    // Wait for results to load
    await expect(
      page.getByText('共找到').or(page.getByText('未找到匹配的素材卡'))
    ).toBeVisible({ timeout: 15000 });

    // Only proceed if there are results
    const noResults = page.getByText('未找到匹配的素材卡');
    if (await noResults.isVisible()) {
      // No data to test against, verify empty state works
      guard.report(testInfo);
      return;
    }

    // Find the first result card and click it
    const firstResult = page.locator('.cursor-pointer').first();
    await firstResult.click();

    // Should navigate to /cards/{id}
    await expect(page).toHaveURL(/\/cards\/.+/, { timeout: 10000 });

    guard.report(testInfo);
  });

  test('搜索页初始状态有跳转链接', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    await page.goto('/search');
    // 初始状态应显示跳转链接
    await expect(page.locator('a', { hasText: '浏览全部素材卡' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a', { hasText: '前往文章库' })).toBeVisible();
    guard.report(testInfo);
  });

  test('搜索页无结果有文章库跳转链接', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    await page.goto('/search');
    await page.getByPlaceholder('输入关键词搜索素材卡...').fill('不存在的关键词xyz789');
    await page.getByRole('button', { name: '搜索' }).click();
    await expect(page.getByText('未找到匹配的素材卡')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('a', { hasText: '前往文章库浏览' })).toBeVisible();
    guard.report(testInfo);
  });

  test('搜索页：加载中状态后数据出现', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.route('**/api/search**', async route => {
      await new Promise(f => setTimeout(f, 500));
      await route.continue();
    });
    await page.goto('/search');
    await page.waitForTimeout(2000);
    // Should have loaded content or empty state
    await expect(page.locator('h1, h2, input, [role="combobox"]').first()).toBeVisible({ timeout: 5000 });
    guard.report(testInfo);
  });
});
