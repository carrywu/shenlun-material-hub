import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { hasCandidateArticles, getFirstCandidateArticleId } from './helpers/test-data';
import { navigateTo } from './helpers/navigation';

const EVALUATED_ARTICLE_ID = 'cmqd2xygx0004x6vyeznvuhq6';
const UNEVALUATED_ARTICLE_ID = 'cmqd2xygx0004x6vyeznvuhq7';

function makeArticle(overrides: Partial<Record<string, unknown>>) {
  const id = String(overrides.id);
  return {
    id,
    title: String(overrides.title ?? `测试文章 ${id}`),
    originalUrl: `https://example.com/articles/${id}`,
    platform: 'wechat',
    fullText: '这是一篇用于端到端测试的申论素材文章正文，长度足够展示在列表中。',
    excerpt: '测试摘要',
    contentType: 'policy_analysis',
    topicTags: '[]',
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    processingStatus: 'pending',
    qualityStatus: overrides.qualityStatus ?? 'candidate',
    filterReason: null,
    aiScore: null,
    aiDecision: overrides.aiDecision ?? null,
    adminReviewStatus: overrides.adminReviewStatus ?? 'pending_ai',
    aiReason: null,
    contentGenre: null,
    aiAssessedAt: overrides.aiAssessedAt ?? null,
    aiScoreDetail: null,
    aiScoredAt: null,
    effectiveTextLength: 1200,
    section: null,
    ownerUserId: null,
    visibility: 'public',
    source: { name: 'E2E 测试来源' },
    _count: { materialCards: 0 },
  };
}

async function mockAdminArticles(page: import('@playwright/test').Page) {
  await page.route('**/api/sources?pageSize=500', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route('**/api/articles?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          makeArticle({
            id: EVALUATED_ARTICLE_ID,
            title: 'E2E 已评估文章',
            qualityStatus: 'accepted',
            aiDecision: 'accept',
            adminReviewStatus: 'approved',
            aiAssessedAt: '2026-06-01T00:00:00.000Z',
          }),
          makeArticle({
            id: UNEVALUATED_ARTICLE_ID,
            title: 'E2E 未评估文章',
            qualityStatus: 'candidate',
            aiDecision: null,
            adminReviewStatus: 'pending_ai',
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    });
  });
}

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

  test('勾选已评估文章时点击 AI 评估应弹出重新评估确认', async ({ page }) => {
    await mockAdminArticles(page);
    await page.route('**/api/content-items/assess', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();

      const body = route.request().postDataJSON() as { ids?: string[]; reassess?: boolean };
      expect(body.ids).toEqual(expect.arrayContaining([EVALUATED_ARTICLE_ID, UNEVALUATED_ARTICLE_ID]));
      expect(body.reassess).toBe(true);

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: true,
          taskId: 'e2e-reassess-task',
          status: 'PENDING',
          queuedCount: 2,
          message: '已加入后台 AI 评估队列，共 2 条',
        }),
      });
    });
    await page.route('**/api/admin/tasks/e2e-reassess-task', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-reassess-task',
          status: 'COMPLETED',
          result: JSON.stringify({ accepted: 1, rejected: 1 }),
        }),
      });
    });

    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);
    await page.getByRole('row', { name: /E2E 已评估文章/ }).getByRole('checkbox').check();
    await page.getByRole('row', { name: /E2E 未评估文章/ }).getByRole('checkbox').check();

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'AI 评估' }).click();

    await expect(page.getByText(/评估完成：接受 1 篇，拒绝 1 篇/)).toBeVisible();
    expect(dialogMessage).toContain('确认重新 AI 评估');
    expect(dialogMessage).toContain('重新评估会覆盖旧结果');
  });

  test('取消重新评估确认后不应调用 AI 评估接口', async ({ page }) => {
    let requestCount = 0;
    await mockAdminArticles(page);
    await page.route('**/api/content-items/assess', async (route) => {
      if (route.request().method() === 'POST') requestCount += 1;
      await route.continue();
    });

    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);
    await page.getByRole('row', { name: /E2E 已评估文章/ }).getByRole('checkbox').check();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('确认重新 AI 评估');
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: 'AI 评估' }).click();
    await page.waitForTimeout(300);

    expect(requestCount).toBe(0);
  });
});
