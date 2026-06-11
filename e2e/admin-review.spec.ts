import { expect, test } from '@playwright/test';

/**
 * P4: 管理员审核流 e2e
 *
 * 依赖 fixture 数据（pending_admin / rejected / approved + cards 文章）。
 * 本地 dev 库无 fixture 时 test.skip；staging 应用 P2 migration 并 seed 后可运行。
 * admin 登录由 global-setup 提供的 storageState 注入。
 */

test.describe('管理员审核流（P4）', () => {
  test('ADMIN 批量通过 pending_admin 文章', async ({ request }) => {
    // 先取一篇 pending_admin
    const list = await request.get('/api/articles?adminReviewStatus=pending_admin&pageSize=1');
    expect(list.status()).toBe(200);
    const listJson = await list.json();
    if (!listJson.data?.length) {
      test.skip(true, '无 pending_admin 文章 fixture（staging apply P2 migration 后）');
    }
    const id = listJson.data[0].id;

    const res = await request.post('/api/admin/content-items/review', {
      data: { ids: [id], action: 'approve' },
    });
    expect(res.status()).toBe(200);

    // 验证已 approved
    const detail = await request.get(`/api/content-items/${id}`);
    expect(detail.status()).toBe(200);
    const dj = await detail.json();
    expect(dj.adminReviewStatus).toBe('approved');
  });

  test('force-approve AI 拒绝的文章（需 note）', async ({ request }) => {
    const rejectedId = process.env.E2E_REJECTED_ARTICLE_ID;
    if (!rejectedId) test.skip(true, '需 E2E_REJECTED_ARTICLE_ID fixture');
    const res = await request.post('/api/admin/content-items/review', {
      data: { ids: [rejectedId], action: 'approve', force: true, note: 'AI 误判' },
    });
    expect(res.status()).toBe(200);
  });

  test('下架 approved 文章 → 用户素材卡被删', async ({ request }) => {
    const id = process.env.E2E_APPROVED_WITH_CARDS_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_WITH_CARDS_ID fixture');

    const res = await request.post('/api/admin/content-items/review', {
      data: { ids: [id], action: 'reject', note: '下架测试' },
    });
    expect(res.status()).toBe(200);

    // 验证 MaterialCard 已删
    const cards = await request.get(`/api/material-cards?contentItemId=${id}`);
    const cj = await cards.json();
    const count = cj.data?.length ?? cj.length ?? 0;
    expect(count).toBe(0);
  });

  test('推送 approved 文章到今日推荐', async ({ request }) => {
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, '需 E2E_APPROVED_ARTICLE_ID fixture');

    const res = await request.post('/api/admin/content-items/feature', {
      data: { id },
    });
    expect(res.status()).toBe(200);
  });

  test('推送未审核文章 → 400', async ({ request }) => {
    const pendingId = process.env.E2E_PENDING_ARTICLE_ID;
    if (!pendingId) test.skip(true, '需 E2E_PENDING_ARTICLE_ID fixture');
    const res = await request.post('/api/admin/content-items/feature', {
      data: { id: pendingId },
    });
    expect(res.status()).toBe(400);
  });
});
