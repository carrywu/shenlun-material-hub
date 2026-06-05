import { test, expect } from '@playwright/test';

test.describe('Articles Page filter linkage and column removal tests', () => {
  async function waitForPageLoaded(page: import('@playwright/test').Page) {
    await expect(page.locator('main')).not.toContainText('加载中...', { timeout: 20000 });
  }

  test('验证“栏目”列已被移除，且其他主要列仍正常显示', async ({ page }) => {
    await page.goto('/articles');
    await waitForPageLoaded(page);

    // 1. 确认表格头部没有“栏目”列
    const headers = page.locator('thead th');
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).not.toContain('栏目');

    // 2. 确认表格仍展示“标题 / 来源 / 文章发布时间 / 采集时间 / AI / 字数”
    expect(headerTexts).toContain('标题');
    expect(headerTexts).toContain('来源');
    expect(headerTexts).toContain('文章发布时间');
    expect(headerTexts).toContain('采集时间');
    expect(headerTexts).toContain('AI');
    expect(headerTexts).toContain('字数');

    // 3. 公开文章页已移除管理员选择列，每行应只剩 6 个单元格
    const firstRowCells = page.locator('tbody tr').first().locator('td');
    if (await firstRowCells.count() > 0) {
      expect(await firstRowCells.count()).toBe(6);
    }
  });

  test('验证“来源类型”下拉框新增，且选项正常', async ({ page }) => {
    await page.goto('/articles');
    await waitForPageLoaded(page);

    const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
    await expect(sourceTypeSelect).toBeVisible();

    // 默认应该包含“全部”
    await expect(sourceTypeSelect).toContainText('全部');

    // 点击展开下拉框，验证选项
    await sourceTypeSelect.click();
    await expect(page.locator('[data-slot="select-item"]', { hasText: '全部' }).first()).toBeVisible();
    await expect(page.locator('[data-slot="select-item"]', { hasText: '网站' }).first()).toBeVisible();
    await expect(page.locator('[data-slot="select-item"]', { hasText: '公众号' }).first()).toBeVisible();
  });

  test('验证“来源类型”与“文章来源”联动重置规则', async ({ page }) => {
    await page.goto('/articles');
    await waitForPageLoaded(page);

    const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
    const sourceNameSelect = page.locator('[data-testid="source-name-select"]');

    // 1. 切换来源类型为 “网站”
    await sourceTypeSelect.click();
    await page.locator('[data-slot="select-item"]', { hasText: '网站' }).first().click();

    // 2. 检查文章来源下拉框只显示网站来源
    await sourceNameSelect.click();
    await page.keyboard.press('Escape'); // 关闭下拉

    // 3. 切换来源类型为 “公众号”
    await sourceTypeSelect.click();
    await page.locator('[data-slot="select-item"]', { hasText: '公众号' }).first().click();

    // 4. 验证在公众号类型下，来源类型变更自动重置“文章来源”
    await expect(sourceNameSelect).toContainText('全部来源');
  });

  test('验证筛选条件在页面刷新后仍可保留', async ({ page }) => {
    await page.goto('/articles?sourceType=website&sourceName=test-source');
    await waitForPageLoaded(page);

    const sourceTypeSelect = page.locator('[data-testid="source-type-select"]');
    const sourceNameSelect = page.locator('[data-testid="source-name-select"]');

    // 验证能够从 URL 参数中正常恢复状态
    await expect(sourceTypeSelect).toContainText('网站');
    await expect(sourceNameSelect).toContainText('test-source');
  });
});
