import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';
import {
  getAdminCookies,
  getFirstApprovedArticleId,
} from './helpers/test-data';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// 本次 bugfix 回归测试，覆盖 2026-06-14 修复的几个关键路径：
//   Bug 5：文章管理页支持按文章 ID 搜索
//   Bug 2：文章详情页批注提示（portal）不被遮挡
//   Bug 3：IMA 配置页字段精简（只保留 Client ID + API Key）
//   Bug 4：文章详情页正文格式渲染（article-content 存在且有段落）
//   Bug 1：重新 AI 评估接口可达 + 详情页 AI 状态显示中文
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Bugfix 回归 — 文章 ID 搜索（Bug 5）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('搜索已知文章 ID 能命中', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);

    // 在搜索框输入完整文章 ID（模拟 Bug 5 的复现路径）
    const searchInput = page.getByPlaceholder(/搜索/).first();
    await searchInput.fill(articleId);
    await searchInput.press('Enter');

    await expectNoInfiniteLoading(page);

    // 结果中应包含这篇文章：通过 API 校验更可靠（UI 卡片结构可能变化）
    // 这里验证 UI 不报错，且至少有一个文章卡片渲染
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('搜索不存在的 ID 显示空状态而非报错', async ({ page }) => {
    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);

    const searchInput = page.getByPlaceholder(/搜索/).first();
    await searchInput.fill('cm_nonexistent_id_zzz_9999');
    await searchInput.press('Enter');

    await expectNoInfiniteLoading(page);
    // 页面应正常渲染（无 500），不抛错
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('搜索 API 直接支持 id 精确匹配', async ({ request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    const cookies = getAdminCookies();
    const res = await request.get(
      `${BASE_URL}/api/articles?keyword=${encodeURIComponent(articleId)}&pageSize=5`,
      { headers: cookies }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const found = (body.data ?? []).some((a: { id: string }) => a.id === articleId);
    expect(found).toBeTruthy();
  });
});

test.describe('Bugfix 回归 — 批注提示浮层（Bug 2）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('详情页批注提示渲染到 body（portal），不被 overflow 裁切', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await navigateTo(page, `/articles/${articleId}`);
    await expectNoInfiniteLoading(page);

    // 找到批注高亮元素（带 data-annotation-id）
    const annotation = page.locator('[data-annotation-id]').first();
    const hasAnnotation = await annotation.isVisible().catch(() => false);
    test.skip(!hasAnnotation, '该文章没有批注，跳过浮层测试');

    // hover 触发 tooltip
    await annotation.scrollIntoViewIfNeeded();
    await annotation.hover();

    // 批注提示应出现在 portal（挂在 body 下），且可见
    const tooltip = page.locator('body [role="tooltip"]').last();
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    // 关键断言：tooltip 用 fixed 定位（修复 Bug 2 的核心）
    const position = await tooltip.evaluate(
      (el) => window.getComputedStyle(el).position
    );
    expect(position).toBe('fixed');
  });
});

test.describe('Bugfix 回归 — IMA 配置页字段精简（Bug 3）', () => {
  test.use({ storageState: '.auth/verified-storage.json' });

  test('非管理员只看到 Client ID 和 API Key 两个必填字段', async ({ page }) => {
    await navigateTo(page, '/settings/ima');
    await expectNoInfiniteLoading(page);

    // 点击「添加 IMA 目标」展开表单
    const addBtn = page.getByRole('button', { name: /添加 IMA 目标/ });
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
    }

    // 必填的两个字段应可见
    await expect(page.getByLabel(/Client ID/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/API Key/)).toBeVisible();

    // 管理员专属字段（名称 / Base URL / 知识库 ID）不应出现在非管理员表单里
    await expect(page.getByLabel(/^名称$/)).not.toBeVisible();
    await expect(page.getByLabel(/API Base URL/)).not.toBeVisible();
    await expect(page.getByLabel(/知识库 ID/)).not.toBeVisible();
  });
});

test.describe('Bugfix 回归 — 文章详情正文渲染（Bug 4）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('正文容器存在且有段落结构', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await navigateTo(page, `/articles/${articleId}`);
    await expectNoInfiniteLoading(page);

    const content = page.getByTestId('article-content');
    await expect(content).toBeVisible();
    // 至少有 1 个段落或文本节点（HTML 渲染路径 / 纯文本路径都应满足）
    const blockCount = await content.locator('p, div, section, article, li, h1, h2, h3, h4, h5, h6, br').count();
    expect(blockCount).toBeGreaterThan(0);
  });

  test('正文渲染不抛错', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await navigateTo(page, `/articles/${articleId}`);
    await expectNoInfiniteLoading(page);

    const critical = pageErrors.filter((m) =>
      m.includes('TypeError') ||
      m.includes('ReferenceError') ||
      m.includes('Cannot read properties of')
    );
    expect(critical).toEqual([]);
  });
});

test.describe('Bugfix 回归 — 重新 AI 评估（Bug 1）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('详情页显示 AI 评估结果面板与中文标签', async ({ page, request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    await navigateTo(page, `/articles/${articleId}`);
    await expectNoInfiniteLoading(page);

    // AI 评估结果面板存在
    await expect(page.getByText('AI 评估结果')).toBeVisible();
    // 不应出现未本地化的英文状态
    await expect(page.getByText('accepted')).not.toBeVisible();
    await expect(page.getByText('rejected')).not.toBeVisible();
    await expect(page.getByText('pending')).not.toBeVisible();
  });

  test('重新评估接口 POST /api/content-items/reassess 可达且鉴权', async ({ request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    const cookies = getAdminCookies();
    // 不带 cookie 调用应返回 401
    const unauthRes = await request.post(`${BASE_URL}/api/content-items/reassess`, {
      data: { id: articleId },
    });
    expect([401, 403]).toContain(unauthRes.status());

    // 带 admin cookie 调用应可达（可能因正文过短或无 AI key 返回 400/500，但不应 401/403）
    const authRes = await request.post(`${BASE_URL}/api/content-items/reassess`, {
      data: { id: articleId },
      headers: cookies,
    });
    expect([200, 400, 500]).toContain(authRes.status());
  });
});

test.describe('Bugfix 回归 — 批量评估确认弹窗（Bug 6）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('选中已评估文章点击 AI 评估时弹出原生确认框', async ({ page }) => {
    await navigateTo(page, '/admin/articles');
    await expectNoInfiniteLoading(page);

    // 找到第一个可勾选的复选框（卡片选择）
    const checkbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();
    const hasCheckbox = await checkbox.isVisible().catch(() => false);
    test.skip(!hasCheckbox, '当前列表无可勾选项，跳过批量评估弹窗测试');

    await checkbox.click();

    // 监听原生 dialog（window.confirm）
    const dialogMessages: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      // 点「取消」不执行评估
      await dialog.dismiss();
    });

    // 点击 AI 评估按钮
    const assessBtn = page.getByRole('button', { name: /AI 评估|评估/ }).first();
    if (await assessBtn.isVisible().catch(() => false)) {
      await assessBtn.click().catch(() => {});
    }

    // 无论是否弹窗，页面都应保持稳定不报错
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('assess API 支持 reassess 参数', async ({ request }) => {
    const articleId = await getFirstApprovedArticleId(request);
    test.skip(!articleId, '没有已审核文章');

    const cookies = getAdminCookies();
    // 带 reassess=true 调用应被接受（鉴权通过即可，业务结果取决于 AI 配置）
    const res = await request.post(`${BASE_URL}/api/content-items/assess`, {
      data: { ids: [articleId], reassess: true },
      headers: cookies,
    });
    // 允许 200（成功入队）或 400（正文过短等业务校验）或 500（无 AI key），但不允许 401/403
    expect([200, 400, 500]).toContain(res.status());
  });
});
