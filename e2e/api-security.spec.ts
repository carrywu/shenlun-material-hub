import { expect, test } from '@playwright/test';
import { loginAsAdminAPI } from './helpers/auth';

/**
 * §API 安全测试
 * 验证 API 端点的认证和授权行为：
 * - 未认证访问受保护 API 返回 401
 * - 公开 API 无需认证可访问
 * - Admin API 未认证返回 401
 * - 已认证用户访问正常
 */

test.describe('API 安全认证', () => {
  // ── 公开 API：无需认证 ──

  test('公开 API：health 端点无需认证', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
  });

  test('公开 API：discover 端点无需认证', async ({ request }) => {
    const res = await request.get('/api/discover');
    // NOTE: P1-6 将给 /api/discover 添加认证，届时此测试应断言 401
    expect(res.status()).toBe(200);
  });

  test('受保护 API：explore 端点需认证', async ({ request }) => {
    const res = await request.get('/api/explore');
    expect(res.status()).toBe(401);
  });

  // ── 受保护 API：未认证返回 401 ──

  test('未认证：content-items 返回 401', async ({ request }) => {
    const res = await request.get('/api/content-items');
    expect(res.status()).toBe(401);
  });

  test('未认证：material-cards 返回 401', async ({ request }) => {
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(401);
  });

  test('未认证：review 返回 401', async ({ request }) => {
    const res = await request.get('/api/review?mode=random&limit=5');
    expect(res.status()).toBe(401);
  });

  test('未认证：sync-records 返回 401', async ({ request }) => {
    const res = await request.get('/api/sync-records');
    expect(res.status()).toBe(401);
  });

  test('未认证：search 返回 401', async ({ request }) => {
    const res = await request.get('/api/search?q=test');
    expect(res.status()).toBe(401);
  });

  test('未认证：export 返回 401', async ({ request }) => {
    const res = await request.get('/api/export');
    expect(res.status()).toBe(401);
  });

  // ── Admin API：未认证返回 401 ──

  test('未认证：admin users 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(401);
  });

  test('未认证：admin logs 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/logs');
    expect(res.status()).toBe(401);
  });

  test('未认证：admin tasks 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/tasks');
    expect(res.status()).toBe(401);
  });

  test('未认证：admin metrics 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/metrics');
    expect(res.status()).toBe(401);
  });

  test('未认证：admin backup export 返回 401', async ({ request }) => {
    const res = await request.get('/api/admin/backup/export');
    expect(res.status()).toBe(401);
  });

  // ── Admin API：未认证 POST 返回 401 ──

  test('未认证：admin clean POST 返回 401', async ({ request }) => {
    const res = await request.post('/api/admin/clean', { data: {} });
    expect(res.status()).toBe(401);
  });

  test('未认证：admin backup import POST 返回 401', async ({ request }) => {
    const res = await request.post('/api/admin/backup/import', { data: {} });
    expect(res.status()).toBe(401);
  });

  test('未认证：sources POST 返回 401', async ({ request }) => {
    const res = await request.post('/api/sources', { data: {} });
    expect(res.status()).toBe(401);
  });

  test('未认证：ai-config POST 返回 401', async ({ request }) => {
    const res = await request.post('/api/ai-config', { data: {} });
    expect(res.status()).toBe(401);
  });

  // ── 已认证管理员：API 正常工作 ──

  test('管理员：content-items 返回 200', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/content-items');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('管理员：material-cards 返回 200', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/material-cards');
    expect(res.status()).toBe(200);
  });

  test('管理员：admin users 返回 200', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(200);
  });

  test('管理员：admin metrics 返回 200', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/admin/metrics');
    expect(res.status()).toBe(200);
  });

  // ── 图片代理安全：SSRF 防护 ──

  test('图片代理：禁止私有 IP', async ({ request }) => {
    const res = await request.get('/api/proxy/image?url=http://127.0.0.1/test.png');
    expect([400, 403]).toContain(res.status());
  });

  test('图片代理：禁止 file 协议', async ({ request }) => {
    const res = await request.get('/api/proxy/image?url=file:///etc/passwd');
    expect([400, 403]).toContain(res.status());
  });

  test('图片代理：禁止非白名单域名', async ({ request }) => {
    const res = await request.get('/api/proxy/image?url=http://evil.com/image.png');
    expect([400, 403]).toContain(res.status());
  });
});

test.describe('API 安全 — 浏览器级别', () => {
  test('未认证用户访问 admin API 页面被重定向', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // 访问 admin 页面应重定向到登录
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 });

    await context.close();
  });
});

// ── P1-T7: WeWe RSS settings route lockdown（admin-only 收紧）──
//
// 背景：playwright.config.ts 顶层设置了 storageState: '.auth/admin-storage.json'，
// 默认 { request } fixture 会自动携带 admin cookie。要测试真正的"未认证"请求，
// 必须用 test.use({ storageState: { cookies: [], origins: [] } }) 清空 cookie —— 这与
// e2e/auth.spec.ts 中"登录页（未认证）"块的做法一致。
//
// 范围说明：
// - 匿名 401（5 个端点）：本块覆盖。
// - ADMIN 200 回归（防过度收紧）：本块覆盖。
// - VERIFIED_USER → 403：当前 e2e 无 VERIFIED_USER fixture（属 P8-T7），该路径已由
//   src/app/api/settings/integrations/wewe-rss/__tests__/route.test.ts 单测覆盖，此处不重复。

test.describe('WeWe RSS 接口权限（P1 收紧）— 未认证 → 401', () => {
  // 清空全局 admin storageState，使 { request } 真正匿名
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未认证 GET settings/wewe-rss → 401', async ({ request }) => {
    const res = await request.get('/api/settings/integrations/wewe-rss');
    expect(res.status()).toBe(401);
  });

  test('未认证 POST settings/wewe-rss → 401', async ({ request }) => {
    const res = await request.post('/api/settings/integrations/wewe-rss', {
      data: { baseUrl: 'http://localhost:4000' },
    });
    expect(res.status()).toBe(401);
  });

  test('未认证 DELETE settings/wewe-rss → 401', async ({ request }) => {
    const res = await request.delete('/api/settings/integrations/wewe-rss');
    expect(res.status()).toBe(401);
  });

  test('未认证 PUT settings/wewe-rss → 401', async ({ request }) => {
    const res = await request.put('/api/settings/integrations/wewe-rss', {
      data: { isEnabled: false },
    });
    expect(res.status()).toBe(401);
  });

  test('未认证 POST settings/wewe-rss/test → 401', async ({ request }) => {
    const res = await request.post('/api/settings/integrations/wewe-rss/test', {
      data: { baseUrl: 'http://localhost:4000' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('WeWe RSS 接口权限（P1 收紧）— ADMIN 回归 → 200', () => {
  // 此处保留全局 admin storageState（不 override），确保 admin 仍可访问，
  // 防止权限收紧过度把 admin 也挡在外面。
  test('ADMIN GET settings/wewe-rss → 200（regression：管理员仍可用）', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/settings/integrations/wewe-rss');
    expect(res.status()).toBe(200);
  });
});
