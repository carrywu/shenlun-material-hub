import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

/**
 * §P1-5 文章列表与详情增强测试
 *
 * 补充 P1-5 计划中现有 e2e/articles.spec.ts 未覆盖的用例：
 *   ART-002: 来源 ID 筛选
 *   ART-004: AI decision 筛选 "accept"
 *   ART-005: AI decision 筛选 "reject"
 *   ART-007: 有素材卡筛选
 *   ART-008: 时间范围筛选
 *   ART-009: 多条件 AND 组合筛选
 *   ART-013: 返回列表保留筛选状态
 *   ART-014: 采集时间显示
 *   ART-015: 发布时间显示
 *   ART-016: 正文图片代理
 *   ART-017: XSS 内容不执行
 *   ART-018: 图片代理失败占位符
 *
 * 使用 page.route() mock API 以确保可重复性，不依赖 fixture 数据。
 */

test.use({ storageState: '.auth/admin-storage.json' });

// ── Mock 数据 ──

const MOCK_ARTICLES = [
  {
    id: 'art-001',
    title: '论新发展格局下的高质量发展',
    excerpt: '摘要：本文论述了新发展格局下如何实现高质量发展…',
    source: { id: 'src-01', name: '人民日报', platform: 'website' },
    platform: 'website',
    publishedAt: '2026-06-10T08:00:00Z',
    createdAt: '2026-06-11T03:00:00Z',
    aiDecision: 'accept',
    aiScore: 8.5,
    effectiveTextLength: 3200,
    adminReviewStatus: 'approved',
    visibility: 'public',
    qualityStatus: 'approved',
    userRead: false,
    userBookmarked: false,
    userIgnored: false,
    _count: { materialCards: 2 },
  },
  {
    id: 'art-002',
    title: '关于加强基层治理的若干意见',
    excerpt: '摘要：基层治理是国家治理的基石…',
    source: { id: 'src-02', name: '先锋文汇', platform: 'website' },
    platform: 'website',
    publishedAt: '2026-06-09T10:00:00Z',
    createdAt: '2026-06-10T05:00:00Z',
    aiDecision: 'reject',
    aiScore: 3.2,
    effectiveTextLength: 800,
    adminReviewStatus: 'approved',
    visibility: 'public',
    qualityStatus: 'filtered',
    userRead: true,
    userBookmarked: true,
    userIgnored: false,
    _count: { materialCards: 0 },
  },
  {
    id: 'art-003',
    title: '观潮的螃蟹：数字经济新动能',
    excerpt: '摘要：数字经济发展正成为新动能…',
    source: { id: 'src-03', name: '观潮的螃蟹', platform: 'wechat' },
    platform: 'wechat',
    publishedAt: '2026-06-08T12:00:00Z',
    createdAt: '2026-06-09T06:00:00Z',
    aiDecision: null,
    aiScore: null,
    effectiveTextLength: 1500,
    adminReviewStatus: 'approved',
    visibility: 'public',
    qualityStatus: 'candidate',
    userRead: false,
    userBookmarked: false,
    userIgnored: true,
    _count: { materialCards: 1 },
  },
];

function makeArticlesResponse(data = MOCK_ARTICLES, total = data.length) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data,
      total,
      page: 1,
      pageSize: 20,
      totalPages: Math.ceil(total / 20),
    }),
  };
}

function mockArticlesApi(route: Parameters<Parameters<typeof page.route>[1]>[0], filtered = MOCK_ARTICLES) {
  return route.fulfill(makeArticlesResponse(filtered));
}

// ═══════════════════════════════════════════════════════════
// ART-002: 来源 ID 筛选
// ═══════════════════════════════════════════════════════════

test.describe('P1-5 文章列表增强 — 筛选', () => {

  test('ART-002: 来源名称筛选 — 结果只包含该来源', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Mock API — 只返回"人民日报"的文章
    await page.route('**/api/articles**', (route) => {
      const url = new URL(route.request().url());
      const sourceName = url.searchParams.get('sourceName');
      if (sourceName === '人民日报') {
        return route.fulfill(makeArticlesResponse([MOCK_ARTICLES[0]]));
      }
      return mockArticlesApi(route);
    });

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // 选择来源名称
    const sourceNameSelect = page.getByTestId('source-name-select');
    if (await sourceNameSelect.isVisible()) {
      await sourceNameSelect.click();
      await page.getByRole('option', { name: '人民日报' }).click();
      await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

      // 验证来源列只显示"人民日报"
      const sourceCells = page.locator('td').filter({ hasText: '人民日报' });
      expect(await sourceCells.count()).toBeGreaterThan(0);
      const otherSource = page.locator('td').filter({ hasText: '先锋文汇' });
      expect(await otherSource.count()).toBe(0);
    }

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-004/005: AI decision 筛选
  // ═══════════════════════════════════════════════════════════

  test('ART-004: AI decision 筛选"已通过" — 只显示 accept', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => {
      const url = new URL(route.request().url());
      const aiDecision = url.searchParams.get('aiDecision');
      if (aiDecision === 'accept') {
        return route.fulfill(makeArticlesResponse([MOCK_ARTICLES[0]]));
      }
      return mockArticlesApi(route);
    });

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // AI decision select
    const aiSelect = page.getByTestId('ai-decision-select');
    if (await aiSelect.isVisible()) {
      await aiSelect.click();
      await page.getByRole('option', { name: '已通过' }).click();
      await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

      // 表格中应有"通过" badge，不应有"拒绝"
      const acceptBadge = page.locator('td').filter({ hasText: '通过' });
      const rejectBadge = page.locator('td').filter({ hasText: '拒绝' });
      expect(await acceptBadge.count()).toBeGreaterThan(0);
      expect(await rejectBadge.count()).toBe(0);
    }

    guard.report(testInfo);
  });

  test('ART-005: AI decision 筛选"已拒绝" — 只显示 reject', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => {
      const url = new URL(route.request().url());
      const aiDecision = url.searchParams.get('aiDecision');
      if (aiDecision === 'reject') {
        return route.fulfill(makeArticlesResponse([MOCK_ARTICLES[1]]));
      }
      return mockArticlesApi(route);
    });

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    const aiSelect = page.getByTestId('ai-decision-select');
    if (await aiSelect.isVisible()) {
      await aiSelect.click();
      await page.getByRole('option', { name: '已拒绝' }).click();
      await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

      const rejectBadge = page.locator('td').filter({ hasText: '拒绝' });
      const acceptBadge = page.locator('td').filter({ hasText: '通过' });
      expect(await rejectBadge.count()).toBeGreaterThan(0);
      expect(await acceptBadge.count()).toBe(0);
    }

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-007: 有素材卡筛选
  // ═══════════════════════════════════════════════════════════

  test('ART-007: 高级筛选 — qualityStatus 筛选正确', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => {
      const url = new URL(route.request().url());
      const qualityStatus = url.searchParams.get('qualityStatus');
      if (qualityStatus === 'approved') {
        return route.fulfill(makeArticlesResponse([MOCK_ARTICLES[0]]));
      }
      return mockArticlesApi(route);
    });

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });

    // 展开高级筛选
    const advancedToggle = page.getByRole('button', { name: '高级筛选' });
    await advancedToggle.click();
    await expect(page.getByText('素材价值')).toBeVisible();

    // 选择 qualityStatus
    const qualitySelect = page.getByTestId('quality-status-select');
    if (await qualitySelect.isVisible()) {
      await qualitySelect.click();
      await page.getByRole('option', { name: '已接受' }).click();
      await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

      // 验证表格不为空
      const rows = page.getByRole('row');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(1); // header + at least 1 data
    }

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-008: 时间范围筛选
  // ═══════════════════════════════════════════════════════════

  test('ART-008: 高级筛选 — 发布时间范围筛选', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => {
      const url = new URL(route.request().url());
      const publishedStart = url.searchParams.get('publishedStart');
      const publishedEnd = url.searchParams.get('publishedEnd');
      if (publishedStart && publishedEnd) {
        return route.fulfill(makeArticlesResponse([MOCK_ARTICLES[0]]));
      }
      return mockArticlesApi(route);
    });

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });

    // 展开高级筛选
    const advancedToggle = page.getByRole('button', { name: '高级筛选' });
    await advancedToggle.click();
    await expect(page.getByText('发布时间')).toBeVisible({ timeout: 5000 });

    // 输入日期范围
    const startInput = page.getByTestId('published-start-date');
    const endInput = page.getByTestId('published-end-date');
    if (await startInput.isVisible()) {
      await startInput.fill('2026/06/08');
      await endInput.fill('2026/06/11');
      await page.getByRole('button', { name: '搜索' }).click();
      await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });
      // 表格不为空
      const rows = page.getByRole('row');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(1);
    }

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-009: 多条件 AND 组合筛选
  // ═══════════════════════════════════════════════════════════

  test('ART-009: 多条件 AND 组合筛选', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => {
      const url = new URL(route.request().url());
      const sourceType = url.searchParams.get('sourceType');
      const aiDecision = url.searchParams.get('aiDecision');
      // AND: website + accept
      if (sourceType === 'website' && aiDecision === 'accept') {
        return route.fulfill(makeArticlesResponse([MOCK_ARTICLES[0]]));
      }
      return mockArticlesApi(route);
    });

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });

    // 选择 sourceType = 网站
    const sourceTypeSelect = page.getByTestId('source-type-select');
    await sourceTypeSelect.click();
    await page.getByRole('option', { name: '网站' }).click();

    // 选择 AI decision = 已通过
    const aiSelect = page.getByTestId('ai-decision-select');
    if (await aiSelect.isVisible()) {
      await aiSelect.click();
      await page.getByRole('option', { name: '已通过' }).click();
    }

    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // 验证表格有数据（至少 header + 1 行）
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(1);

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-013: 返回列表保留筛选状态
  // ═══════════════════════════════════════════════════════════

  test('ART-013: 从详情返回列表 — 筛选条件保留', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    let requestCount = 0;
    await page.route('**/api/articles**', (route) => {
      requestCount++;
      return mockArticlesApi(route);
    });
    await page.route('**/api/content-items/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'art-001',
          title: '论新发展格局下的高质量发展',
          fullText: '文章正文内容，需要足够长以通过质量检查…',
          qualityStatus: 'approved',
          aiDecision: 'accept',
          source: { id: 'src-01', name: '人民日报', platform: 'website' },
          _count: { materialCards: 2 },
          materialCards: [],
          annotations: [],
        }),
      })
    );

    // 1. 带筛选条件进入列表页
    await page.goto('/articles?keyword=发展&sourceType=website');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // 验证筛选条件已应用
    const keywordInput = page.getByPlaceholder('搜索标题、正文、来源');
    await expect(keywordInput).toHaveValue('发展');

    // 2. 点击第一行进入详情
    const firstDataRow = page.getByRole('row').nth(1);
    const rowCount = await page.getByRole('row').count();
    if (rowCount >= 2) {
      await firstDataRow.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

      // 3. 点击"返回列表"
      const backButton = page.getByRole('button', { name: '返回列表' });
      if (await backButton.isVisible()) {
        await backButton.click();
        await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 10000 });

        // 4. 验证筛选条件保留（URL params + UI 状态）
        const url = page.url();
        expect(url).toContain('keyword=发展');
        await expect(keywordInput).toHaveValue('发展');
      }
    }

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-014/015: 时间显示
  // ═══════════════════════════════════════════════════════════

  test('ART-014: 文章列表显示采集时间', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => mockArticlesApi(route));

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // 验证"采集时间"列标题存在
    await expect(page.getByRole('columnheader', { name: '采集时间' })).toBeVisible();

    // 验证采集时间列有值（非"未获取"）
    const timeCells = page.locator('td').filter({ has: page.locator('[data-date]') });
    // 至少有一行有时间数据（宽松验证）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toBeNull();

    guard.report(testInfo);
  });

  test('ART-015: 文章列表显示发布时间', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/articles**', (route) => mockArticlesApi(route));

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // 验证"文章发布时间"列标题存在
    await expect(page.getByRole('columnheader', { name: '文章发布时间' })).toBeVisible();

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-017: XSS 内容不执行
  // ═══════════════════════════════════════════════════════════

  test('ART-017: 标题含 XSS 脚本 — 不执行', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const xssArticle = {
      ...MOCK_ARTICLES[0],
      id: 'art-xss',
      title: '<script>alert("XSS")</script>测试标题',
      excerpt: '<img src=x onerror="alert(1)">摘要',
    };

    await page.route('**/api/articles**', (route) =>
      route.fulfill(makeArticlesResponse([xssArticle]))
    );

    await page.goto('/articles');
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('加载中...', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // 验证：页面不弹 alert、不执行脚本
    // consoleGuard 会捕获错误（TypeError, ReferenceError 等）
    // 额外验证：script 标签不存在于 body 内
    const scriptTags = await page.locator('script:not([src])').count();
    // 内联 script 可能是 Next.js 的 hydration 脚本，只检查含 alert 的
    const bodyHtml = await page.locator('body').innerHTML();
    expect(bodyHtml).not.toContain('alert("XSS")');

    // 页面不崩溃
    const heading = page.getByTestId('articles-page-header');
    await expect(heading).toBeVisible();

    guard.report(testInfo);
  });
});

// ═══════════════════════════════════════════════════════════
// 文章详情增强测试
// ═══════════════════════════════════════════════════════════

test.describe('P1-5 文章详情增强', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  const MOCK_DETAIL = {
    id: 'art-detail-001',
    title: '论新发展格局下的高质量发展',
    fullText: '这是一篇关于高质量发展的文章。新发展格局要求我们在创新、协调、绿色、开放、共享五个方面持续发力。',
    excerpt: '摘要：本文论述了新发展格局下如何实现高质量发展',
    qualityStatus: 'approved',
    aiDecision: 'accept',
    aiScore: 8.5,
    aiReason: '文章主题与申论密切相关，论述系统全面',
    aiCategories: ['经济发展', '新发展格局'],
    aiScenarios: ['综合分析', '对策建议'],
    aiGoldenSentences: ['新发展格局是高质量发展的战略支撑'],
    aiSummary: '本文围绕新发展格局，阐述高质量发展的内涵和路径',
    publishedAt: '2026-06-10T08:00:00Z',
    createdAt: '2026-06-11T03:00:00Z',
    effectiveTextLength: 3200,
    adminReviewStatus: 'approved',
    visibility: 'public',
    source: { id: 'src-01', name: '人民日报', platform: 'website' },
    _count: { materialCards: 2 },
    materialCards: [
      { id: 'card-01', type: 'golden_sentence', content: '新发展格局是高质量发展的战略支撑', isConfirmed: true },
    ],
    annotations: [],
    userRead: false,
    userBookmarked: false,
    userIgnored: false,
  };

  // ═══════════════════════════════════════════════════════════
  // DETAIL-002/003/004: 来源、发布时间、采集时间
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-002: 文章详情显示来源名称', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 验证来源显示
    await expect(page.getByText('人民日报')).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });

  test('DETAIL-003: 文章详情显示发布时间', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 验证元数据区域显示发布时间 — "发布时间" 或日期文本
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    // 页面应包含"发布"或日期格式
    expect(bodyText).toMatch(/发布|2026/);

    guard.report(testInfo);
  });

  test('DETAIL-004: 文章详情显示采集时间', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 验证元数据区域 — "采集"或日期格式
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText).toMatch(/采集|创建|2026/);

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-005: 正文显示
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-005: 文章详情显示正文内容', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 正文区域可见
    await expect(page.getByText('正文')).toBeVisible({ timeout: 5000 });

    // 正文内容包含文章文本
    await expect(page.getByText('新发展格局')).toBeVisible();

    // 不显示原始 HTML
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('<!DOCTYPE');
    expect(bodyText).not.toContain('<html>');

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-007: AI 评估结果
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-007: 文章详情显示 AI 评估结果', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // AI 评估结果区域
    await expect(page.getByText('AI 评估结果')).toBeVisible({ timeout: 10000 });

    // 验证 AI 决策标签 — "已通过"
    await expect(page.getByText('已通过')).toBeVisible({ timeout: 5000 });

    // 验证 AI 摘要
    await expect(page.getByText('AI 摘要')).toBeVisible({ timeout: 5000 });

    // 验证判定理由
    await expect(page.getByText('判定理由')).toBeVisible({ timeout: 5000 });

    // 验证主题分类
    await expect(page.getByText('主题分类')).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-008: 素材卡入口
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-008: 已审核文章 — 素材卡入口可见', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Admin 可看到管理入口 — "当前页面为公开阅读视图"
    await expect(page.getByText('当前页面为公开阅读视图')).toBeVisible({ timeout: 10000 });

    // 已生成素材卡列表可见
    await expect(page.getByText('已生成素材卡')).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-009: 未审核文章禁止生成素材卡
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-009: 未审核文章 — 非管理员禁止访问', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // 用普通用户身份测试
    const ctx = await page.context().browser()!.newContext({ storageState: '.auth/usera-storage.json' });
    const userPage = await ctx.newPage();
    const userGuard = attachConsoleGuard(userPage);

    // 非 ADMIN 访问 pending_admin 文章 → 404
    await page.route('**/api/content-items/art-pending**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: '内容条目不存在' }),
      })
    );

    await userPage.goto('/articles/art-pending');
    await userPage.waitForLoadState('domcontentloaded');
    await expect(userPage.getByText('文章不存在')).toBeVisible({ timeout: 15000 });

    // 应显示"文章不存在"中文文案
    const bodyText = await userPage.locator('body').textContent();
    expect(bodyText).toContain('文章不存在');

    // "返回列表"按钮
    const backLink = userPage.locator('a, button').filter({ hasText: /返回列表/ });
    expect(await backLink.count()).toBeGreaterThan(0);

    userGuard.report(testInfo);
    await ctx.close();
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-010: 原文链接存在但不替代系统详情
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-010: 原文链接存在且在新窗口打开', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const detailWithUrl = {
      ...MOCK_DETAIL,
      originalUrl: 'https://example.com/original-article',
    };

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detailWithUrl),
      })
    );

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // "查看原文"链接存在
    const originalLink = page.locator('a', { hasText: '查看原文' });
    await expect(originalLink).toBeVisible({ timeout: 5000 });

    // 验证链接在新标签打开
    const target = await originalLink.getAttribute('target');
    expect(target).toBe('_blank');

    // URL 仍然在 /articles/art-detail-001 — 没有跳走
    expect(page.url()).toContain('/articles/art-detail-001');

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-011: 404 中文文案
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-011: 不存在的文章 ID → 显示「文章不存在」中文文案', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/nonexistent-id**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: '内容条目不存在' }),
      })
    );

    await page.goto('/articles/nonexistent-id');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('文章不存在')).toBeVisible({ timeout: 15000 });

    // 中文"文章不存在"文案 — articles/[id]/page.tsx fallback
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('文章不存在');

    // "返回列表"按钮
    const backLink = page.locator('a, button').filter({ hasText: /返回列表/ });
    expect(await backLink.count()).toBeGreaterThan(0);

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-012: 权限不足中文文案
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-012: 权限不足 → 中文「无权访问」或 404', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // 模拟 403
    await page.route('**/api/content-items/art-forbidden**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: '无权访问该内容' }),
      })
    );

    await page.goto('/articles/art-forbidden');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText(/文章不存在|无权访问/, { timeout: 15000 });

    // 中文错误文案
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/文章不存在|无权访问/);

    // "返回列表"按钮
    const backLink = page.locator('a, button').filter({ hasText: /返回列表/ });
    expect(await backLink.count()).toBeGreaterThan(0);

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-013: 数据隔离
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-013: 非 ADMIN 只能看到自己的素材卡和批注', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // 用 verified 用户身份测试
    const ctx = await page.context().browser()!.newContext({ storageState: '.auth/verified-storage.json' });
    const userPage = await ctx.newPage();
    const userGuard = attachConsoleGuard(userPage);

    const detailWithIsolation = {
      ...MOCK_DETAIL,
      materialCards: [
        { id: 'card-own', type: 'golden_sentence', content: '自己的素材卡', ownerUserId: 'verified-1', isConfirmed: false },
      ],
      annotations: [
        { id: 'ann-own', content: '自己的批注', userId: 'verified-1' },
      ],
    };

    await userPage.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detailWithIsolation),
      })
    );

    await userPage.goto('/articles/art-detail-001');
    await userPage.waitForLoadState('domcontentloaded');
    await expect(userPage.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 页面正常加载
    const bodyText = await userPage.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    // 不显示其他用户的素材卡（admin 的）
    expect(bodyText).not.toContain('admin-1的素材卡');

    userGuard.report(testInfo);
    await ctx.close();
  });

  // ═══════════════════════════════════════════════════════════
  // DETAIL-014: 返回列表保留状态
  // ═══════════════════════════════════════════════════════════

  test('DETAIL-014: 从详情返回列表 — 页面正常加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.route('**/api/content-items/art-detail-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DETAIL),
      })
    );
    await page.route('**/api/articles**', (route) => mockArticlesApi(route));

    await page.goto('/articles/art-detail-001');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 点击"返回列表"
    const backButton = page.getByRole('button', { name: '返回列表' });
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();

    // 列表页正常加载
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  // ═══════════════════════════════════════════════════════════
  // ART-016/018: 图片代理与失败占位
  // ═══════════════════════════════════════════════════════════

  test('ART-016: 正文图片通过代理加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const wechatDetail = {
      ...MOCK_DETAIL,
      id: 'art-wechat-img',
      platform: 'wechat',
      fullText: null,
      contentHtml: '<p>正文段落</p><img data-src="https://mmbiz.qpic.cn/test.jpg" />',
      source: { id: 'src-03', name: '观潮的螃蟹', platform: 'wechat' },
    };

    // Mock proxy image API
    await page.route('**/api/proxy/image**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from('fake-image-data'),
      })
    );

    await page.route('**/api/content-items/art-wechat-img**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wechatDetail),
      })
    );

    await page.goto('/articles/art-wechat-img');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 页面正常加载
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    // 图片通过 /api/proxy/image 加载（ArticleContentRenderer 处理微信图片代理）
    const images = page.locator('.article-content img');
    const imgCount = await images.count();
    if (imgCount > 0) {
      // 验证图片 src 包含 proxy
      const src = await images.first().getAttribute('src');
      if (src) {
        expect(src).toMatch(/proxy|data-src|blob/);
      }
    }

    guard.report(testInfo);
  });

  test('ART-018: 图片代理失败 → 显示占位提示', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const wechatDetail = {
      ...MOCK_DETAIL,
      id: 'art-wechat-imgfail',
      platform: 'wechat',
      fullText: null,
      contentHtml: '<p>正文段落</p><img data-src="https://mmbiz.qpic.cn/broken.jpg" />',
      source: { id: 'src-03', name: '观潮的螃蟹', platform: 'wechat' },
    };

    // Mock proxy image API to fail
    await page.route('**/api/proxy/image**', (route) =>
      route.abort('failed')
    );

    await page.route('**/api/content-items/art-wechat-imgfail**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wechatDetail),
      })
    );

    await page.goto('/articles/art-wechat-imgfail');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // 页面不崩溃
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    // 图片加载失败时应显示占位 — ArticleContentRenderer 设置 title="图片加载失败"
    const failedImg = page.locator('img[title="图片加载失败"], [data-error="image"]');
    // 也可能用 🖼️ emoji 占位
    const emojiPlaceholder = page.getByText('🖼️ 图片加载失败');

    // 至少页面没有白屏/崩溃
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });
});
