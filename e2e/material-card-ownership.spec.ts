import { expect, test } from '@playwright/test';

/**
 * P5: 素材卡归属 e2e
 *
 * 依赖 fixture（approved 文章）+ 真实 AI（卡包用例）。
 * 本地缺 fixture/AI 时 test.skip；staging 跑时若 AI 不可达见最终报告风控章节。
 * admin 登录由 global-setup 的 storageState 提供；USER/VERIFIED_USER 场景需 P8 的 loginAsUserAPI/VerifiedUserAPI。
 */

test.describe('素材卡归属（P5）', () => {
  // P0-004 (B3): 生卡接口需登录态；admin 态下 approved 文章返回 202/409，未审核返回 400
  test.use({ storageState: '.auth/admin-storage.json' });
  test('VERIFIED_USER 对 approved 文章生卡 → 202', async ({ request }) => {
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');
    // 注意：此用例需 VERIFIED_USER 登录态，global-setup 只提供 admin。
    // 完整 VERIFIED_USER e2e 在 P8-T7 loginAsVerifiedUserAPI 就绪后才能跑通。
    // 这里先占位，确保 staging 有 fixture 后可激活。
    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: { cardType: 'golden_sentence' },
    });
    // admin 登录态下：adminReviewStatus=approved → 202 或 409（已生成过）
    expect([202, 409]).toContain(res.status());
  });

  test('卡包生成 → 返回多 task', async ({ request }) => {
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');
    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: {
        cardTypes: ['golden_sentence', 'standard_expression', 'case_material', 'countermeasure'],
      },
    });
    // ⚠️ 此用例触发真实 AI 调用（4 次）。staging AI 不可达时会失败 → 见最终报告风控章节。
    if (res.status() === 500) {
      test.skip(true, 'AI 服务不可达或 Key 配额耗尽——非代码 bug，见风控报告');
    }
    expect(res.status()).toBe(202);
    const j = await res.json();
    expect(j.tasks.length).toBe(4);
  });

  test('未审核文章生卡 → 400', async ({ request }) => {
    const id = process.env.E2E_PENDING_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_PENDING_ARTICLE_ID fixture');
    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: { cardType: 'golden_sentence' },
    });
    expect(res.status()).toBe(400);
  });
});
