import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { getFirstApprovedArticleId } from './helpers/test-data';

test.describe('文章详情页同步到 IMA', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('点击同步到 IMA 应显示成功反馈', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await page.route(`**/api/articles/${articleId}/sync-to-ima`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sourceType: 'article',
          imaDocumentId: 'e2e-doc-1',
          syncedAt: new Date().toISOString(),
          message: '测试环境模拟结果：已同步到 IMA',
        }),
      });
    });

    await page.goto(`/articles/${articleId}`);
    await expectNoInfiniteLoading(page);
    await page.getByRole('button', { name: '同步到 IMA' }).click();

    await expect(page.getByRole('button', { name: /同步中/ })).toBeVisible();
    await expect(page.getByText(/测试环境模拟结果：已同步到 IMA|已同步到 IMA/)).toBeVisible();
  });

  test('IMA 配置缺失时应显示明确错误', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await page.route(`**/api/articles/${articleId}/sync-to-ima`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          sourceType: 'article',
          errorCode: 'IMA_CONFIG_MISSING',
          errorMessage: 'IMA 未配置，请先配置 IMA',
        }),
      });
    });

    await page.goto(`/articles/${articleId}`);
    await expectNoInfiniteLoading(page);
    await page.getByRole('button', { name: '同步到 IMA' }).click();

    await expect(page.getByText(/IMA 未配置|请先配置 IMA|配置缺失/)).toBeVisible();
  });
});
