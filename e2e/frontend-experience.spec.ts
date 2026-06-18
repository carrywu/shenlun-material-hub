import { expect, test } from '@playwright/test';

/**
 * P7: 前台体验 e2e（点击流）
 *
 * 需求方强调现有 e2e 缺前端体验，本 spec 补「用户点按钮、走完整流程」。
 * 依赖 fixture 账号 + 文章。本地 dev 库无 fixture 时 test.skip。
 * admin 登录态由文件级 storageState 提供；USER/VERIFIED_USER 完整链路需 P8 loginAsUserAPI。
 *
 * 类 B：原「公开页面」describe（测 /discover /explore）与 /my-articles 用例
 * 已随 Round A 路由删除而移除（死代码）。
 */

// 受保护页面：生卡 API 需登录态
test.describe('前台体验（P7）— 受保护页面', () => {
  // P0-004 (B3): 生卡接口需登录态；admin 同为登录用户可覆盖
  test.use({ storageState: '.auth/admin-storage.json' });

  test('VERIFIED_USER 详情页生卡流程（依赖 fixture + AI）', async ({ request }) => {
    // 占位：完整 VERIFIED_USER 点击流需 P8 loginAsVerifiedUserAPI + approved fixture 文章
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');
    // admin 态下验证详情可达
    const res = await request.get(`/api/content-items/${id}`);
    expect(res.status()).toBe(200);
  });
});
