import { expect, test } from '@playwright/test';

/**
 * P6: 收藏功能 e2e
 *
 * 依赖 fixture（approved / pending_admin 文章）。本地缺 fixture 时 test.skip。
 * admin 登录态由 global-setup 提供；USER/VERIFIED_USER 完整链路在 P8 loginAsUserAPI 就绪后激活。
 */

test.describe('收藏功能（P6）', () => {
  // P0-004 (B3): /api/favorites 需登录态；admin 同为登录用户可覆盖
  test.use({ storageState: '.auth/admin-storage.json' });
  test('批量收藏 approved 文章', async ({ request }) => {
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');
    const res = await request.post('/api/favorites', {
      data: { contentItemIds: [id] },
    });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.added).toBeGreaterThanOrEqual(0); // 已收藏过则 0，否则 1
  });

  test('GET 收藏列表', async ({ request }) => {
    const res = await request.get('/api/favorites');
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(Array.isArray(j.data)).toBe(true);
  });

  test('未审核文章不能收藏（被过滤）', async ({ request }) => {
    const pendingId = process.env.E2E_PENDING_ARTICLE_ID;
    if (!pendingId) test.skip(true, '需 E2E_PENDING_ARTICLE_ID fixture');
    const res = await request.post('/api/favorites', {
      data: { contentItemIds: [pendingId] },
    });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.added).toBe(0);
    expect(j.skipped).toBe(1);
  });

  test('移除收藏 → 删用户卡', async ({ request }) => {
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');
    const res = await request.delete(`/api/favorites/${id}`);
    expect(res.status()).toBe(200);
  });
});
