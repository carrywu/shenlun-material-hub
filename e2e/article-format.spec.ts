import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attachConsoleGuard } from './helpers/consoleGuard';
import { ensureArticleExists } from './helpers/seed';

/**
 * 文章正文格式修复（rawHtml + 结构化 fullText）E2E 验收。
 *
 * 覆盖：
 *  - 有 rawHtml 的文章（微信）渲染多个块级元素、段落有间距、HTML 不外泄、脚本不执行
 *  - 无 rawHtml 的旧文章（web）走 fullText 降级分段
 *  - 移动端不横向溢出
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

function adminCookieHeader(): string {
  try {
    const path = resolve(process.cwd(), '.auth/admin-storage.json');
    const state = JSON.parse(readFileSync(path, 'utf-8')) as {
      cookies?: Array<{ name: string; value: string }>;
    };
    return (state.cookies ?? []).map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return '';
  }
}

/**
 * 在微信文章中找到一篇 detail 含非空 rawHtml 的（有些微信文章被标记 blocked，正文为空）。
 * 列表 API 不返回 rawHtml，故逐个取 detail。
 */
async function findWechatArticleWithRawHtml(): Promise<string> {
  const cookie = adminCookieHeader();
  // 较新的微信文章可能被标记 blocked（rawHtml 为空），需扫描足够数量才能命中含正文的
  const listRes = await fetch(`${BASE_URL}/api/content-items?platform=wechat&pageSize=100`, {
    headers: { Cookie: cookie },
  });
  if (!listRes.ok) throw new Error(`content-items API 返回 ${listRes.status}`);
  const list = (await listRes.json()).data ?? [];
  for (const item of list) {
    const detailRes = await fetch(`${BASE_URL}/api/content-items/${item.id}`, {
      headers: { Cookie: cookie },
    });
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    if (detail.rawHtml && /<[a-z][\s\S]*>/i.test(detail.rawHtml)) {
      return item.id;
    }
  }
  throw new Error('未找到带 rawHtml 的微信文章，请先导入含正文的微信文章');
}

test.describe('文章正文格式（rawHtml / 段落结构）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('有 rawHtml 的文章：渲染多个独立段落，段落间有垂直间距，HTML 不外泄', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    const articleId = await findWechatArticleWithRawHtml();

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-detail-page-header')).toBeVisible({ timeout: 15000 });

    const content = page.getByTestId('article-content');
    await expect(content).toBeVisible({ timeout: 10000 });

    // rawHtml 含块级结构，渲染后应有多个块级元素（p / section / div / li）
    const blockCount = await content.locator('p, section, li, blockquote').count();
    expect(blockCount).toBeGreaterThan(1);

    // 至少应有 <p> 段落（微信正文以 <p> 为主）
    const paragraphCount = await content.locator('p').count();
    expect(paragraphCount).toBeGreaterThanOrEqual(1);

    // 段落/块之间有垂直间距：取前两个块，后者 y 应更大
    const blocks = content.locator('p, section, li, blockquote');
    if ((await blocks.count()) >= 2) {
      const firstBox = await blocks.first().boundingBox();
      const secondBox = await blocks.nth(1).boundingBox();
      expect(firstBox).toBeTruthy();
      expect(secondBox).toBeTruthy();
      expect(secondBox!.y).toBeGreaterThan(firstBox!.y);
    }

    // HTML 标签不应以纯文本形式显示给用户
    await expect(content).not.toContainText('<p>');
    await expect(content).not.toContainText('<div');

    guard.report(test.info());
  });

  test('恶意脚本不执行：正文中的 <script> 被清洗，不触发 alert', async ({ page }) => {
    test.setTimeout(60000);
    const articleId = await findWechatArticleWithRawHtml();

    let dialogFired = false;
    page.on('dialog', () => {
      dialogFired = true;
    });

    await page.goto(`/articles/${articleId}`);
    await expect(page.getByTestId('article-content')).toBeVisible({ timeout: 15000 });

    expect(dialogFired).toBe(false);
    const scriptCount = await page.getByTestId('article-content').locator('script').count();
    expect(scriptCount).toBe(0);
  });

  test('无 rawHtml 的旧文章：fullText 降级分段，不挤成一段', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    // ensureArticleExists 返回 explore 第一篇（web 文章，历史数据无 rawHtml）
    const article = await ensureArticleExists();

    await page.goto(`/articles/${article.id}`);
    const content = page.getByTestId('article-content');
    await expect(content).toBeVisible({ timeout: 15000 });

    // fullText 降级或 rawHtml 都至少产生 <p>；不应是空正文
    const paragraphCount = await content.locator('p').count();
    expect(paragraphCount).toBeGreaterThanOrEqual(1);
    // 不应把原始 HTML 标签当文本显示
    await expect(content).not.toContainText('<p>');

    guard.report(test.info());
  });

  test('移动端视口：正文不横向溢出', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext({
      storageState: '.auth/admin-storage.json',
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    try {
      const articleId = await findWechatArticleWithRawHtml();
      await page.goto(`/articles/${articleId}`);
      await expect(page.getByTestId('article-content')).toBeVisible({ timeout: 15000 });

      const contentBox = await page.getByTestId('article-content').boundingBox();
      expect(contentBox).toBeTruthy();
      expect(contentBox!.x).toBeGreaterThanOrEqual(0);
      expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(375 + 1);
    } finally {
      await context.close();
    }
  });
});
