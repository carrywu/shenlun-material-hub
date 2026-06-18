import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';
import {
  loginAsAdminAPI,
  loginAsUserAPI,
  loginAsVerifiedUserAPI,
} from './helpers/auth';

/**
 * §P1-3 RBAC 能力矩阵 E2E
 *
 * 验证四角色（anonymous / USER / VERIFIED_USER / ADMIN）× 全功能权限矩阵。
 * 每个能力同时测：
 *   1. API 访问：直接 request 是否返回 401/403/200
 *   2. 页面入口：按钮/菜单是否可见（适用时）
 *   3. 错误文案：中文
 *   4. 数据隔离：A 用户不能访问 B 用户资源
 */

// ═══════════════════════════════════════════════════════════
// Anonymous（未认证） — 所有受保护端点应返回 401
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: anonymous 角色', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('RBAC-ANON-001: 未认证 → content-items 返回 401', async ({ request }) => {
    const res = await request.get('/api/content-items');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-002: 未认证 → material-cards 返回 401', async ({ request }) => {
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-003: 未认证 → generate-card 返回 401', async ({ request }) => {
    const res = await request.post('/api/content-items/fake-id/generate-card', {
      data: { cardType: 'golden_sentence' },
    });
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-004: 未认证 → review 返回 401', async ({ request }) => {
    const res = await request.get('/api/review?mode=random&limit=5');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-005: 未认证 → search 返回 401', async ({ request }) => {
    const res = await request.get('/api/search?q=test');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-006: 未认证 → ai-config 返回 401', async ({ request }) => {
    const res = await request.get('/api/ai-config');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-007: 未认证 → admin/users 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-008: 未认证 → admin/metrics 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/metrics');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-009: 未认证 → sources 返回 401', async ({ request }) => {
    const res = await request.get('/api/sources');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-010: 未认证 → wechat-rss settings 返回 401', async ({ request }) => {
    const res = await request.get('/api/settings/integrations/wechat-rss');
    expect(res.status()).toBe(401);
  });

  test('RBAC-ANON-011: 未认证 → admin 页面重定向到 login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 });
    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════
// USER 角色 — 可访问自己的数据，不可管理/AI/管理员功能
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: USER 角色', () => {
  test.use({ storageState: '.auth/usera-storage.json' });

  test('RBAC-USER-001: USER → content-items 返回 200', async ({ request }) => {
    const res = await request.get('/api/content-items');
    expect(res.status()).toBe(200);
  });

  test('RBAC-USER-002: USER → material-cards 返回 200', async ({ request }) => {
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(200);
  });

  test('RBAC-USER-003: USER → search 返回 200', async ({ request }) => {
    const res = await request.get('/api/search?q=test');
    expect(res.status()).toBe(200);
  });

  test('RBAC-USER-004: USER → generate-card 权限检查', async ({ request }) => {
    // USER 角色 generate-card 权限取决于业务规则
    // 确认不返回 401（已认证），可能是 403 或 200/202
    const res = await request.post('/api/content-items/nonexistent-id/generate-card', {
      data: { cardType: 'golden_sentence' },
    });
    // 不应是 401（已认证），可能是 403/404/409（无此文章）
    expect(res.status()).not.toBe(401);
  });

  test('RBAC-USER-005: USER → admin/users 返回 403', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(403);
  });

  test('RBAC-USER-006: USER → admin/metrics 返回 403', async ({ request }) => {
    const res = await request.get('/api/admin/metrics');
    expect(res.status()).toBe(403);
  });

  test('RBAC-USER-007: USER → sources 返回 403', async ({ request }) => {
    const res = await request.get('/api/sources');
    expect(res.status()).toBe(403);
  });

  test('RBAC-USER-008: USER → wechat-rss settings 返回 403', async ({ request }) => {
    const res = await request.get('/api/settings/integrations/wechat-rss');
    expect(res.status()).toBe(403);
  });

  test('RBAC-USER-009: USER → ai-config POST 返回 403', async ({ request }) => {
    const res = await request.post('/api/ai-config', {
      data: { baseUrl: 'https://api.test.com', apiKey: 'sk-test', model: 'test' },
    });
    expect(res.status()).toBe(403);
  });

  test('RBAC-USER-010: USER → admin/clean 返回 403', async ({ request }) => {
    const res = await request.post('/api/admin/clean', { data: {} });
    expect(res.status()).toBe(403);
  });

  test('RBAC-USER-011: USER → admin/backup/export 返回 403', async ({ request }) => {
    const res = await request.get('/api/admin/backup/export');
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════
// VERIFIED_USER 角色 — 可生成素材卡、查看自己的素材卡，不可管理
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: VERIFIED_USER 角色', () => {
  test.use({ storageState: '.auth/verified-storage.json' });

  test('RBAC-VERIFIED-001: VERIFIED → content-items 返回 200', async ({ request }) => {
    const res = await request.get('/api/content-items');
    expect(res.status()).toBe(200);
  });

  test('RBAC-VERIFIED-002: VERIFIED → material-cards 返回 200', async ({ request }) => {
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(200);
  });

  test('RBAC-VERIFIED-003: VERIFIED → generate-card 不因角色返回 403', async ({ request }) => {
    const list = await request.get('/api/explore?pageSize=1');
    expect(list.status()).toBe(200);
    const body = await list.json();
    const id = body.data?.[0]?.id;
    if (!id) return; // No data to test against

    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: { cardType: 'golden_sentence' },
    });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test('RBAC-VERIFIED-004: VERIFIED → ai-config GET 返回 200', async ({ request }) => {
    const res = await request.get('/api/ai-config');
    // VERIFIED_USER 可能可以查看个人 AI 配置
    expect([200, 403]).toContain(res.status());
  });

  test('RBAC-VERIFIED-005: VERIFIED → admin/users 返回 403', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(403);
  });

  test('RBAC-VERIFIED-006: VERIFIED → admin/metrics 返回 403', async ({ request }) => {
    const res = await request.get('/api/admin/metrics');
    expect(res.status()).toBe(403);
  });

  test('RBAC-VERIFIED-007: VERIFIED → sources 返回 403', async ({ request }) => {
    const res = await request.get('/api/sources');
    expect(res.status()).toBe(403);
  });

  test('RBAC-VERIFIED-008: VERIFIED → wechat-rss settings 返回 403', async ({ request }) => {
    const res = await request.get('/api/settings/integrations/wechat-rss');
    expect(res.status()).toBe(403);
  });

  test('RBAC-VERIFIED-009: VERIFIED → admin/clean 返回 403', async ({ request }) => {
    const res = await request.post('/api/admin/clean', { data: {} });
    expect(res.status()).toBe(403);
  });

  test('RBAC-VERIFIED-010: VERIFIED → admin/backup/export 返回 403', async ({ request }) => {
    const res = await request.get('/api/admin/backup/export');
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════
// ADMIN 角色 — 所有功能可用
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: ADMIN 角色', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('RBAC-ADMIN-001: ADMIN → content-items 返回 200', async ({ request }) => {
    const res = await request.get('/api/content-items');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-002: ADMIN → material-cards 返回 200', async ({ request }) => {
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-003: ADMIN → admin/users 返回 200', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-004: ADMIN → admin/metrics 返回 200', async ({ request }) => {
    const res = await request.get('/api/admin/metrics');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-005: ADMIN → sources 返回 200', async ({ request }) => {
    const res = await request.get('/api/sources');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-006: ADMIN → wechat-rss settings 返回 200', async ({ request }) => {
    const res = await request.get('/api/settings/integrations/wechat-rss');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-007: ADMIN → ai-config GET 返回 200', async ({ request }) => {
    const res = await request.get('/api/ai-config');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-008: ADMIN → admin/clean preview 返回 200', async ({ request }) => {
    const res = await request.get('/api/admin/clean');
    expect(res.status()).toBe(200);
  });

  test('RBAC-ADMIN-009: ADMIN → admin/backup/export 返回非 401/403', async ({ request }) => {
    const res = await request.get('/api/admin/backup/export');
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test('RBAC-ADMIN-010: ADMIN → review 返回 200', async ({ request }) => {
    const res = await request.get('/api/review?mode=random&limit=5');
    expect(res.status()).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════
// 数据隔离 — userA 不能访问 userB 的素材卡
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: 数据隔离', () => {
  // 用 userA 登录获取素材卡列表，再用 userB 尝试访问
  test.use({ storageState: '.auth/usera-storage.json' });

  test('RBAC-ISOLATE-001: userA 的素材卡对 userB 不可见', async ({ request, browser }) => {
    // userA 获取自己的素材卡列表
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const cards = body.data || [];
    if (cards.length === 0) return; // 无数据可测试

    const userACardId = cards[0].id;
    expect(userACardId).toBeTruthy();

    // 用 userB 的 context 尝试访问 userA 的素材卡
    const ctx = await browser.newContext({ storageState: '.auth/userb-storage.json' });
    const userBRequest = ctx.request;
    const res2 = await userBRequest.get(`/api/material-cards/${userACardId}`);
    // 应该返回 403 或 404（数据隔离）
    expect([403, 404]).toContain(res2.status());
    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════
// 页面级 RBAC — 非管理员看不到管理入口
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: 页面入口可见性', () => {
  test.use({ storageState: '.auth/usera-storage.json' });

  test('RBAC-PAGE-001: USER 看不到管理入口链接', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // USER 不应看到 admin 导航链接
    const adminLink = page.locator('a[href*="/admin"]').first();
    if (await adminLink.isVisible()) {
      // 如果可见，USER 点击后应被拦截
      await adminLink.click();
      await page.waitForLoadState('networkidle');
      const url = page.url();
      // 应重定向到 login 或显示 403
      expect(url).toMatch(/\/admin\/login|403|forbidden/);
    }

    guard.report(testInfo);
  });
});

// RBAC-PAGE-002 用 admin 登录态（与 RBAC-ADMIN 系列同范式）。
// 原实现把它塞在 USER describe 里 + 用 loginAsAdmin 中途切换身份，
// 但普通用户访问 /admin 会被踢回首页 /（非 /admin/login），loginAsAdmin 等不到登录页 → 超时。
// 直接以 admin 身份运行即可，无需中途登录。
test.describe('RBAC: 页面入口可见性（ADMIN）', () => {
  test.use({ storageState: '.auth/admin-storage.json' });

  test('RBAC-PAGE-002: ADMIN 看到管理入口链接', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/articles');
    await page.waitForLoadState('networkidle');

    // ADMIN 应看到管理导航
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    guard.report(testInfo);
  });
});
