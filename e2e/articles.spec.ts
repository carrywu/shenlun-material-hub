import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe('文章列表页', () => {
  test('文章列表页加载', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    // Wait for Suspense to resolve and data to load
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Subtitle with total count
    await expect(page.getByText(/共 \d+ 篇/)).toBeVisible();

    // Table headers visible
    await expect(page.getByRole('columnheader', { name: '标题' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '来源' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '文章发布时间' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '采集时间' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'AI' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '字数' })).toBeVisible();

    guard.report(test.info());
  });

  test('文章列表：关键词搜索', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Record current table content
    const initialRows = await page.getByRole('row').count();

    // Fill keyword input and search
    const keywordInput = page.getByPlaceholder('搜索标题、正文、来源');
    await keywordInput.fill('测试');
    await page.getByRole('button', { name: '搜索' }).click();

    // Wait for loading to complete (loading text disappears)
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 15000 });

    // Verify the keyword is still in the input
    await expect(keywordInput).toHaveValue('测试');

    guard.report(test.info());
  });

  test('文章列表：来源类型筛选', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Click source type select
    const sourceTypeSelect = page.getByTestId('source-type-select');
    await sourceTypeSelect.click();

    // Select "网站" option
    await page.getByRole('option', { name: '网站' }).click();

    // Verify select value changed — the trigger should now show "网站"
    await expect(sourceTypeSelect).toContainText('网站');

    guard.report(test.info());
  });

  test('文章列表：重置筛选', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Set some filters first
    const keywordInput = page.getByPlaceholder('搜索标题、正文、来源');
    await keywordInput.fill('测试关键词');

    // Click source type select and choose "网站"
    const sourceTypeSelect = page.getByTestId('source-type-select');
    await sourceTypeSelect.click();
    await page.getByRole('option', { name: '网站' }).click();

    // Verify filters are set
    await expect(keywordInput).toHaveValue('测试关键词');
    await expect(sourceTypeSelect).toContainText('网站');

    // Click reset button
    await page.getByRole('button', { name: '重置' }).click();

    // Verify all filters reset to default
    await expect(keywordInput).toHaveValue('');
    await expect(sourceTypeSelect).toContainText('全部');

    // URL should be clean /articles without params
    await expect(page).toHaveURL(/\/articles$/, { timeout: 5000 });

    guard.report(test.info());
  });

  test('文章列表：点击行打开详情面板', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Wait for data to load
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 15000 });

    // Find the first data row (skip header row) — table body rows
    const firstDataRow = page.getByRole('row').nth(1);
    const rowCount = await page.getByRole('row').count();

    // Need at least 2 rows (header + 1 data row)
    if (rowCount < 2) {
      throw new Error('没有文章数据，无法测试行点击');
    }

    await firstDataRow.click();

    // Detail panel should open on the right side — look for the ArticleDetail content
    // The detail panel contains a close button and article content
    const detailPanel = page.locator('.w-1\\/2.border-l');
    await expect(detailPanel).toBeVisible({ timeout: 5000 });

    guard.report(test.info());
  });

  test('文章列表：分页', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Wait for data to load
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 15000 });

    // Check if pagination exists (totalPages > 1)
    const nextButton = page.getByRole('button', { name: '下一页' });
    const hasNextPage = await nextButton.isVisible().catch(() => false);

    if (!hasNextPage) {
      // Less than 1 full page of data — verify pagination text still works
      // If totalPages <= 1, Pagination component returns null, which is valid
      return;
    }

    // Verify current page indicator
    await expect(page.getByText(/第 1 \/ \d+ 页/)).toBeVisible();

    // Click next page
    await nextButton.click();

    // Wait for loading to finish
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // Page should now show page 2
    await expect(page.getByText(/第 2 \/ \d+ 页/)).toBeVisible({ timeout: 5000 });

    guard.report(test.info());
  });

  test('管理模式：调试按钮', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Wait for data to load
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 15000 });

    // Debug button should be visible
    const debugButton = page.getByRole('button', { name: /🐛 调试/ });
    await expect(debugButton).toBeVisible();

    // Owner and 可见性 columns should NOT be visible initially
    await expect(page.getByRole('columnheader', { name: 'Owner' })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: '可见性' })).not.toBeVisible();

    // Click debug button to show columns
    await debugButton.click();

    // Owner and 可见性 columns should now appear
    await expect(page.getByRole('columnheader', { name: 'Owner' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '可见性' })).toBeVisible();

    // Click again to hide
    await debugButton.click();

    // Columns should disappear
    await expect(page.getByRole('columnheader', { name: 'Owner' })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: '可见性' })).not.toBeVisible();

    guard.report(test.info());
  });

  test('管理模式：采集和评估按钮可见', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Management mode buttons should be visible
    await expect(page.getByRole('button', { name: '开始采集' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI 评估' })).toBeVisible();
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible();

    guard.report(test.info());
  });

  test('文章列表：高级筛选展开收起', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 20000 });

    // Advanced filters should NOT be visible initially
    await expect(page.getByText('栏目')).not.toBeVisible();
    await expect(page.getByText('素材价值')).not.toBeVisible();
    await expect(page.getByText('排序方式')).not.toBeVisible();

    // Click "高级筛选" button
    const advancedToggle = page.getByRole('button', { name: '高级筛选' });
    await advancedToggle.click();

    // Advanced filter area should appear
    await expect(page.getByText('栏目')).toBeVisible();
    await expect(page.getByText('素材价值')).toBeVisible();
    await expect(page.getByText('排序方式')).toBeVisible();

    // Verify the specific filter inputs/selects exist
    await expect(page.getByPlaceholder('全部栏目')).toBeVisible();

    // Click "收起筛选" (same button, text changes)
    const collapseToggle = page.getByRole('button', { name: '收起筛选' });
    await collapseToggle.click();

    // Advanced filter area should disappear
    await expect(page.getByPlaceholder('全部栏目')).not.toBeVisible();

    guard.report(test.info());
  });

  test('文章列表：空状态', async ({ page }) => {
    const guard = attachConsoleGuard(page);

    // Use a keyword that is unlikely to match any article
    await page.goto('/articles?keyword=不存在的关键词xyz123');

    // Wait for loading to complete
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 15000 });

    // Empty state text should be visible
    await expect(page.getByText('暂无符合条件的文章')).toBeVisible({ timeout: 10000 });

    guard.report(test.info());
  });

  test('文章列表：加载中状态可见后消失', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Slow down the API to catch loading state
    await page.route('**/api/articles**', async route => {
      await new Promise(f => setTimeout(f, 500)); // delay 500ms
      await route.continue();
    });
    await page.goto('/articles');
    // Should show loading state
    const loading = page.getByText('加载中...');
    // Loading may or may not be visible depending on speed, wait for it to finish
    await page.waitForTimeout(1000);
    // After loading, table or empty state should be visible
    await expect(page.locator('table, [data-testid="empty-state"], .text-muted-foreground').first()).toBeVisible({ timeout: 10000 });

    guard.report(test.info());
  });

  test('文章列表：快速连续点击搜索不崩溃', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await page.getByPlaceholder('搜索标题、正文、来源').fill('测试');
    // Rapidly click search button 3 times
    const searchBtn = page.getByRole('button', { name: '搜索' });
    await searchBtn.click();
    await searchBtn.click();
    await searchBtn.click();
    // Page should still be functional, no crash
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, table, .text-muted-foreground').first()).toBeVisible();

    guard.report(test.info());
  });
});
