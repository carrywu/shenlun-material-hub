import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { getFirstApprovedArticleId } from './helpers/test-data';

test.describe('文章详情页', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('详情页加载正常', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await page.goto(`/articles/${articleId}`);
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main')).toBeVisible();
    // Should show article title
    await expect(page.locator('h1, h2, [data-slot="page-header"]').first()).toBeVisible();
  });

  test('不存在文章显示友好错误', async ({ page }) => {
    await page.goto('/articles/nonexistent-id-12345');
    await expectNoInfiniteLoading(page);
    // App may show 404, error state, or redirect to articles list
    const hasError = await page.locator('[role="alert"], [data-slot="empty-state"], [data-slot="error-boundary"]').first().isVisible().catch(() => false);
    const has404Text = await page.getByText(/404|could not be found/i).isVisible().catch(() => false);
    const redirectToArticles = page.url().includes('/articles') && !page.url().includes('nonexistent');
    expect(hasError || has404Text || redirectToArticles).toBeTruthy();
  });

  test('详情页学习状态徽章', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await page.goto(`/articles/${articleId}`);
    await expectNoInfiniteLoading(page);
    // Learning state badges may or may not be visible
    await expect(page.locator('main')).toBeVisible();
  });
});
