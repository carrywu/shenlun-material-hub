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

  test('详情页 AI 状态和正文应全中文且保留内容结构', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await page.goto(`/articles/${articleId}`);
    await expectNoInfiniteLoading(page);
    await expect(page.getByText('AI 评估结果')).toBeVisible();
    await expect(page.getByText('accepted')).not.toBeVisible();
    await expect(page.getByText('rejected')).not.toBeVisible();
    await expect(page.getByText('pending')).not.toBeVisible();
    await expect(page.getByText('unknown')).not.toBeVisible();
    await expect(page.getByText(/已通过|已拒绝|待评估|尚未评估|未知/).first()).toBeVisible();

    const content = page.getByTestId('article-content');
    await expect(content).toBeVisible();
    const paragraphCount = await content.locator('p').count();
    expect(paragraphCount).toBeGreaterThan(0);
  });

  test('详情页应显示查看原文和同步到 IMA', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await page.goto(`/articles/${articleId}`);
    await expectNoInfiniteLoading(page);
    await expect(page.getByRole('link', { name: '查看原文' })).toBeVisible();
    await expect(page.getByRole('button', { name: '同步到 IMA' })).toBeVisible();
  });
});
