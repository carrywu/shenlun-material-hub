import { expect, test } from '@playwright/test';
import { loginAsUserAPI } from './helpers/auth';

/**
 * P8-T7: 角色分层 + 升级 e2e。
 *
 * - 匿名注册测试：无需任何 fixture，dev/staging 都可跑。
 * - 邀请码升级测试：依赖 seed 里预创建的有效邀请码，缺 env 则跳过。
 * - USER 调用受限接口 / USER 升级：需要 USER fixture 账号 + 独立 storageState，
 *   当前 dev DB 缺 USER fixture，故依赖 env/seed 才执行，否则 skip。
 *
 * 全部 spec 用空 storageState 覆盖项目级 admin cookie，避免污染。
 */
test.describe('角色分层 + 升级（P8）', () => {
  // 匿名 / USER 测试均需独立 storageState，避免 globalSetup 的 admin cookie 污染
  test.use({ storageState: { cookies: [], origins: [] } });

  test('USER 注册无需邀请码', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: {
        username: `e2e_user_${Date.now()}`,
        password: 'testpass123',
      },
    });
    expect(res.status()).toBe(201);
    const j = await res.json();
    expect(j.user.role).toBe('USER');
  });

  test('注册时填有效邀请码 → VERIFIED_USER', async ({ request }) => {
    const code = process.env.E2E_UPGRADE_INVITATION_CODE;
    test.skip(
      !code,
      '需 E2E_UPGRADE_INVITATION_CODE 指向一个有效（未过期、未耗尽）的 seed 邀请码',
    );
    const res = await request.post('/api/auth/register', {
      data: {
        username: `e2e_verified_${Date.now()}`,
        password: 'testpass123',
        invitationCode: code,
      },
    });
    expect(res.status()).toBe(201);
    const j = await res.json();
    expect(j.user.role).toBe('VERIFIED_USER');
  });

  test('USER 调 generate-card → 403（需 USER fixture）', async ({ request }) => {
    // 缺 USER fixture 账号时直接跳过，避免在 dev DB 上失败
    test.skip(
      !process.env.E2E_USER_USERNAME || !process.env.E2E_USER_PASSWORD,
      '需 E2E_USER_USERNAME / E2E_USER_PASSWORD fixture',
    );
    await loginAsUserAPI(request);
    const res = await request.post('/api/material-cards/generate', {
      data: { articleId: 'any' },
    });
    expect([403, 404]).toContain(res.status());
  });
});
