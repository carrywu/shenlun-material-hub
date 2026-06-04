import { test, expect } from '@playwright/test';

test.describe('全站 UI 中文化与体验一致性验收测试', () => {
  let wechatArticleId = '';
  let articleId = '';
  let cardId = '';

  async function waitForPageLoaded(page: import('@playwright/test').Page) {
    await expect(page.locator('main')).not.toContainText('加载中...', { timeout: 20000 });
  }

  test.beforeAll(async () => {
    // 动态通过正在运行的开发服务器 API 接口获取测试数据 ID，避免本地 tsx/CommonJS/ESM 加载冲突
    try {
      const exploreRes = await fetch('http://localhost:3001/api/explore?pageSize=10');
      if (exploreRes.ok) {
        const json = await exploreRes.json();
        if (json.data && json.data.length > 0) {
          articleId = json.data[0].id;
          
          // 查找微信文章
          const wechatItem = json.data.find((item: { platform: string; id: string }) => item.platform === 'wechat');
          if (wechatItem) {
            wechatArticleId = wechatItem.id;
          }
        }
      }

      // 如果 explore 里没找到微信文章，尝试直接到内容条目列表查询微信文章
      if (!wechatArticleId) {
        const itemsRes = await fetch('http://localhost:3001/api/content-items?platform=wechat&pageSize=5');
        if (itemsRes.ok) {
          const json = await itemsRes.json();
          if (json.data && json.data.length > 0) {
            wechatArticleId = json.data[0].id;
          }
        }
      }

      const cardsRes = await fetch('http://localhost:3001/api/material-cards?pageSize=5');
      if (cardsRes.ok) {
        const json = await cardsRes.json();
        if (json.data && json.data.length > 0) {
          cardId = json.data[0].id;
        }
      }
    } catch (err) {
      console.warn('API fetch failed in beforeAll, E2E will fall back to skip if IDs empty', err);
    }
  });

  test('测试 1：探索区 /explore 筛选器和卡片跳转中文化', async ({ page }) => {
    await page.goto('/explore');

    // 1. 检查筛选器默认文案为“全部平台”和“全部类型”，不显示原始的 "all"
    await expect(page.locator('text=全部平台')).toBeVisible();
    await expect(page.locator('text=全部类型')).toBeVisible();

    // 确保普通控件或文本里没有暴露出来的 bare "all"
    const bodyText = await page.innerText('body');
    
    // 我们期望筛选下拉控件等没有直接渲染 bare 的 "all" 字符串
    const textLines = bodyText.split('\n').map(l => l.trim().toLowerCase());
    expect(textLines).not.toContain('all');

    // 2. 检查文章卡片点击跳转逻辑
    const firstCard = page.locator('div.border.rounded-lg.p-4').first();
    if (await firstCard.count() > 0) {
      // 点击卡片本身，验证跳转到站内文章详情页 /articles/{id}
      await firstCard.click();
      await page.waitForURL(/\/articles\//);
      expect(page.url()).toContain('/articles/');
      
      // 确认跳转后详情页能正常加载
      await waitForPageLoaded(page);
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    }
  });

  test('测试 2：文章详情页“单独生成指定类型”下拉选择框中文化', async ({ page }) => {
    if (!articleId) {
      test.skip();
      return;
    }
    await page.goto(`/articles/${articleId}`);
    await waitForPageLoaded(page);

    // 1. 检查一键生成 Select 默认值是否不是 golden_sentence
    const selectTrigger = page.locator('button[data-slot="select-trigger"]').first();
    await expect(selectTrigger).toBeVisible();
    
    const triggerText = await selectTrigger.textContent();
    expect(triggerText).toContain('申论金句'); // 默认应该是“申论金句”而不是 "golden_sentence"
    expect(triggerText).not.toContain('golden_sentence');

    // 2. 点击下拉列表，验证所有选项均为中文，不出现英文 code 
    await selectTrigger.click();
    await expect(page.locator('text=规范词')).toBeVisible();
    await expect(page.locator('text=案例素材')).toBeVisible();
    await expect(page.locator('text=对策表达')).toBeVisible();
    await expect(page.locator('text=数据事实')).not.toBeVisible();
    await expect(page.locator('text=data_fact')).not.toBeVisible();
  });

  test('测试 3：微信正文图片渲染与大图预览', async ({ page }) => {
    if (!wechatArticleId) {
      test.skip();
      return;
    }
    await page.goto(`/articles/${wechatArticleId}`);
    await waitForPageLoaded(page);

    // 1. 检查微信正文内是否存在图片且 src 走代理链接
    const articleImgs = page.locator('.article-content img');
    if (await articleImgs.count() > 0) {
      const firstImg = articleImgs.first();
      await expect(firstImg).toBeVisible();
      
      const src = await firstImg.getAttribute('src');
      expect(src).toContain('/api/proxy/image?url=');

      // 2. 模拟点击大图预览，检查毛玻璃 Overlay
      await firstImg.click();
      const previewOverlay = page.locator('text=关闭');
      await expect(previewOverlay).toBeVisible();
      
      // 点击关闭
      await previewOverlay.click();
      await expect(previewOverlay).not.toBeVisible();
    }
  });

  test('测试 4：AI 生成卡片详情无英文 JSON 裸露', async ({ page }) => {
    if (!cardId) {
      test.skip();
      return;
    }
    // 访问素材卡详情页
    await page.goto(`/cards/${cardId}`);
    await waitForPageLoaded(page);

    // 确保整个页面默认可见区域不包含英文 JSON 键，如 "expression", "oral", "examType"
    const visibleText = await page.innerText('body');
    expect(visibleText).not.toContain('"expression"');
    expect(visibleText).not.toContain('"oral"');
    expect(visibleText).not.toContain('"examType"');
    expect(visibleText).not.toContain('expression:');
    expect(visibleText).not.toContain('oral:');
    expect(visibleText).not.toContain('examType:');

    // 检查小标题视觉层级相关的文字是否存在
    await expect(page.locator('text=亮点建议')).toBeVisible();
  });

  test('测试 5：AI 配置页提示词管理无废弃类型', async ({ page }) => {
    await page.goto('/settings/ai');
    await waitForPageLoaded(page);

    await expect(page.locator('text=提示词配置')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=文章评估提示词')).toBeVisible();
    await expect(page.locator('text=申论金句提示词')).toBeVisible();

    const visibleText = await page.innerText('body');
    expect(visibleText).not.toContain('数据事实提示词');
    expect(visibleText).not.toContain('card_data_fact');
  });
});
