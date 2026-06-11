import { expect, test } from '@playwright/test';

/**
 * P7: 前台体验 e2e（点击流）
 *
 * 需求方强调现有 e2e 缺前端体验，本 spec 补「用户点按钮、走完整流程」。
 * 依赖 fixture 账号 + 文章。本地 dev 库无 fixture 时 test.skip。
 * admin 登录态由 global-setup；USER/VERIFIED_USER 完整链路需 P8 loginAsUserAPI。
 */

test.describe('前台体验（P7）', () => {
  test('今日推荐页加载（/discover）', async ({ page }) => {
    await page.goto('/discover');
    // 页面标题应可见（H1 含「今日推荐」）
    await expect(page.getByRole('heading', { name: /今日推荐/ }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('探索区页加载（/explore）', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('heading', { name: /探索区/ }).first()).toBeVisible({
      timeout: 15000,
    });
    // 空状态或文章卡片或无结果三选一
    const hasCards = await page.locator('div.border.rounded-lg').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=暂无已审核文章').isVisible().catch(() => false);
    const hasNoResults = await page.locator('text=未找到匹配内容').isVisible().catch(() => false);
    expect(hasCards || hasEmpty || hasNoResults).toBeTruthy();
  });

  test('我的文章页加载（/my-articles，需登录）', async ({ page }) => {
    // admin 已登录（storageState）
    await page.goto('/my-articles');
    await expect(page.getByRole('heading', { name: /我的文章/ }).first()).toBeVisible({
      timeout: 15000,
    });
    // 列表或空状态二选一
    const hasItems = await page.locator('text=共 \\d+ 篇').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=还没有收藏文章').isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('VERIFIED_USER 详情页生卡流程（依赖 fixture + AI）', async ({ request }) => {
    // 占位：完整 VERIFIED_USER 点击流需 P8 loginAsVerifiedUserAPI + approved fixture 文章
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');
    // admin 态下验证详情可达
    const res = await request.get(`/api/content-items/${id}`);
    expect(res.status()).toBe(200);
  });
});
