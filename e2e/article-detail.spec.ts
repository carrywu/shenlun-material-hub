import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';
import { ensureArticleExists, ensureWechatArticleExists } from './helpers/seed';

test.describe('文章详情页', () => {
  // P0-004 (B3): 详情页用例验证 admin 视角（管理视图提示、文章批注等），需 admin storageState
  test.use({ storageState: '.auth/admin-storage.json' });
  let articleId: string;

  test.beforeAll(async () => {
    const article = await ensureArticleExists();
    articleId = article.id;
    if (!articleId) {
      throw new Error('ensureArticleExists returned no ID — cannot run article detail tests');
    }
  });

  test('文章详情：页面加载显示标题和内容', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);

    // Wait for article to load
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Article title should contain text
    const titleText = await page.getByTestId('article-detail-page-header').textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.length).toBeGreaterThan(0);

    // Content area should be visible — the 正文 card
    await expect(page.getByText('正文')).toBeVisible();

    // No raw HTML in the visible body text
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('<!DOCTYPE html>');
    expect(bodyText).not.toContain('<html>');
    expect(bodyText).not.toContain('<head>');

    guard.report(test.info());
  });

  test('文章详情：收藏切换', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Find the bookmark toggle button (title contains "收藏" or "取消收藏")
    const bookmarkButton = page.locator('button[title="收藏"], button[title="取消收藏"]');
    await expect(bookmarkButton.first()).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialTitle = await bookmarkButton.first().getAttribute('title');
    const wasBookmarked = initialTitle === '取消收藏';

    // Click to toggle
    await bookmarkButton.first().click();

    // Verify state changed
    const expectedTitle = wasBookmarked ? '收藏' : '取消收藏';
    await expect.poll(
      async () => await bookmarkButton.first().getAttribute('title'),
      { timeout: 5000, message: `收藏切换后按钮 title 应变为 ${expectedTitle}` }
    ).toBe(expectedTitle);

    guard.report(test.info());
  });

  test('文章详情：已读切换', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Find the read toggle button (title contains "标记已读" or "标记未读")
    const readButton = page.locator('button[title="标记已读"], button[title="标记未读"]');
    await expect(readButton.first()).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialTitle = await readButton.first().getAttribute('title');
    const wasRead = initialTitle === '标记未读';

    // Click to toggle
    await readButton.first().click();

    // 状态更新依赖 PUT /api/content-items/[id] 返回后 setArticle，是异步的。
    // 固定 500ms 会和 API 响应赛跑（重试时甚至看到两次方向相反的失败）。
    // 改成轮询 title 翻转，给 5s 余量。
    const expectedTitle = wasRead ? '标记已读' : '标记未读';
    await expect.poll(
      async () => await readButton.first().getAttribute('title'),
      { timeout: 5000, message: `已读切换后按钮 title 应变为 ${expectedTitle}` }
    ).toBe(expectedTitle);

    guard.report(test.info());
  });

  test('文章详情：查看原文链接', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Find the "查看原文" link
    const originalLink = page.locator('a', { hasText: '查看原文' });
    await expect(originalLink).toBeVisible();

    // Verify it has an href attribute
    const href = await originalLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!.length).toBeGreaterThan(0);

    // Verify it opens in a new tab
    const target = await originalLink.getAttribute('target');
    expect(target).toBe('_blank');

    guard.report(test.info());
  });

  test('文章详情：图片预览', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Need a WeChat article that likely has images
    const wechatArticle = await ensureWechatArticleExists();

    await page.goto(`/articles/${wechatArticle.id}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Wait for content to fully render
    await expect(page.getByText('正文')).toBeVisible({ timeout: 10000 });

    // Find images inside the article content area
    const articleImages = page.locator('.article-content img');

    // Wait for at least one image to be visible
    await expect.poll(async () => await articleImages.count(), {
      timeout: 10000,
      message: '等待文章图片加载',
    }).toBeGreaterThan(0);

    // Click the first visible image
    const firstImg = articleImages.first();
    await firstImg.click();

    // Overlay should appear with close button
    const closeButton = page.locator('button', { hasText: '关闭' });
    await expect(closeButton).toBeVisible({ timeout: 5000 });

    // Verify the preview image is visible
    const previewImage = page.locator('img[alt="微信正文图片预览"]');
    await expect(previewImage).toBeVisible();

    // Click close button
    await closeButton.click();

    // Overlay should disappear
    await expect(closeButton).not.toBeVisible({ timeout: 5000 });

    guard.report(test.info());
  });

  test('文章详情：管理视图提示', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Admin should see the public view notice
    await expect(page.getByText('当前页面为公开阅读视图')).toBeVisible({ timeout: 10000 });

    // Admin should also see the link to admin articles
    await expect(page.locator('a', { hasText: '前往后台文章管理' })).toBeVisible();

    // Admin-only annotation section should be visible
    await expect(page.getByText('文章批注')).toBeVisible();

    guard.report(test.info());
  });

  test('文章详情：返回列表', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Find the back button
    const backButton = page.getByRole('button', { name: '返回列表' });
    await expect(backButton).toBeVisible();

    // Click back button
    await backButton.click();

    // Should navigate back to /articles
    await expect(page).toHaveURL(/\/articles$/, { timeout: 10000 });

    // The articles list page should be loaded
    await expect(page.getByTestId('articles-page-header')).toBeVisible({ timeout: 10000 });

    guard.report(test.info());
  });
});

test.describe('文章详情页 — 认证用户视角', () => {
  test.use({ storageState: '.auth/verified-storage.json' });
  let articleId: string;

  test.beforeAll(async () => {
    const article = await ensureArticleExists();
    articleId = article.id;
    if (!articleId) {
      throw new Error('ensureArticleExists returned no ID — cannot run article detail tests');
    }
  });

  test('文章详情：认证用户可生成素材卡且不显示 AI 评估', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    // Wait for sidebar to load
    await expect(page.getByText('快捷操作')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: 'AI 评估' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '生成素材卡' })).toBeVisible();
    await expect(page.getByText('使用你的个人 AI 配置生成私有素材卡')).toBeVisible();

    guard.report(test.info());
  });
});

test.describe('文章详情页 — 普通用户视角', () => {
  test.use({ storageState: '.auth/usera-storage.json' });
  let articleId: string;

  test.beforeAll(async () => {
    const article = await ensureArticleExists();
    articleId = article.id;
    if (!articleId) {
      throw new Error('ensureArticleExists returned no ID — cannot run article detail tests');
    }
  });

  test('文章详情：普通用户看到升级引导', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('快捷操作')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'AI 评估' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '生成素材卡' })).not.toBeVisible();
    await expect(page.getByText('升级为认证用户后可使用个人 AI 配置生成素材卡')).toBeVisible();
    await expect(page.getByRole('link', { name: '去账号设置升级' })).toHaveAttribute('href', '/settings/account');

    guard.report(test.info());
  });
});
