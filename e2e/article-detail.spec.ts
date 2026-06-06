import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';
import { ensureArticleExists, ensureWechatArticleExists } from './helpers/seed';

test.describe('文章详情页', () => {
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
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Article title (h1) should contain text
    const titleText = await page.locator('h1').textContent();
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
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Find the bookmark toggle button (title contains "收藏" or "取消收藏")
    const bookmarkButton = page.locator('button[title="收藏"], button[title="取消收藏"]');
    await expect(bookmarkButton.first()).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialTitle = await bookmarkButton.first().getAttribute('title');
    const wasBookmarked = initialTitle === '取消收藏';

    // Click to toggle
    await bookmarkButton.first().click();

    // Wait a moment for the state to update
    await page.waitForTimeout(500);

    // Verify state changed
    const newTitle = await bookmarkButton.first().getAttribute('title');
    if (wasBookmarked) {
      expect(newTitle).toBe('收藏');
    } else {
      expect(newTitle).toBe('取消收藏');
    }

    guard.report(test.info());
  });

  test('文章详情：已读切换', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Find the read toggle button (title contains "标记已读" or "标记未读")
    const readButton = page.locator('button[title="标记已读"], button[title="标记未读"]');
    await expect(readButton.first()).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialTitle = await readButton.first().getAttribute('title');
    const wasRead = initialTitle === '标记未读';

    // Click to toggle
    await readButton.first().click();

    // Wait a moment for the state to update
    await page.waitForTimeout(500);

    // Verify state changed
    const newTitle = await readButton.first().getAttribute('title');
    if (wasRead) {
      expect(newTitle).toBe('标记已读');
    } else {
      expect(newTitle).toBe('标记未读');
    }

    guard.report(test.info());
  });

  test('文章详情：查看原文链接', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

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
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Wait for content to fully render
    await expect(page.getByText('正文')).toBeVisible({ timeout: 10000 });

    // Find images inside the article content area
    const articleImages = page.locator('.article-content img');

    if ((await articleImages.count()) === 0) {
      throw new Error(
        '微信文章中没有图片，无法测试图片预览功能。请确保测试数据库中的微信文章包含图片内容。'
      );
    }

    // Click the first image
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

  test('文章详情：AI 评估按钮', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Wait for sidebar to load
    await expect(page.getByText('快捷操作')).toBeVisible({ timeout: 10000 });

    // Find AI assess button in the sidebar
    const assessButton = page.getByRole('button', { name: 'AI 评估' });
    await expect(assessButton).toBeVisible();

    // Click the button
    await assessButton.click();

    // Button should show loading state (Loader2 spinner appears)
    // The button either shows a spinner or shows the same text but disabled
    // Wait a short time to see the loading state
    await page.waitForTimeout(500);

    // The button should either be disabled or show loading indicator
    // After the request completes, a toast should appear
    // We just verify the button was clickable and didn't cause a crash

    guard.report(test.info());
  });

  test('文章详情：管理视图提示', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto(`/articles/${articleId}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

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
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Find the back button
    const backButton = page.getByRole('button', { name: '返回列表' });
    await expect(backButton).toBeVisible();

    // Click back button
    await backButton.click();

    // Should navigate back to /articles
    await expect(page).toHaveURL(/\/articles$/, { timeout: 10000 });

    // The articles list page should be loaded
    await expect(page.getByRole('heading', { name: '文章列表', exact: false })).toBeVisible({ timeout: 10000 });

    guard.report(test.info());
  });
});
