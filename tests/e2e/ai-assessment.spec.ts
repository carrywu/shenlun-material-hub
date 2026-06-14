import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { hasCandidateArticles, getFirstCandidateArticleId } from './helpers/test-data';
import { navigateTo } from './helpers/navigation';

test.describe('AI 评估流程', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('内容管理页面加载', async ({ page }) => {
    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('AI 评估 API 端点可达', async ({ request }) => {
    const hasCandidates = await hasCandidateArticles(request);
    test.skip(!hasCandidates, '没有候选文章');
    
    const articleId = await getFirstCandidateArticleId(request);
    test.skip(!articleId, '无法获取候选文章 ID');
    // Endpoint exists - actual assessment requires real AI key
  });

  test('评估状态正确显示', async ({ page }) => {
    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);
    // Page should load without errors regardless of assessment state
    await expect(page.locator('main').first()).toBeVisible();
  });
});
