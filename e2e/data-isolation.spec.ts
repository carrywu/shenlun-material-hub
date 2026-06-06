import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";
import { loginAsAdminAPI } from "./helpers/auth";

test.describe("API 数据隔离与权限", () => {
  // ── Unauthenticated: all protected APIs return 401 ───────────────────────────

  test("未登录：受保护 GET API 全部返回 401", async ({ request }) => {
    const endpoints = [
      "/api/content-items",
      "/api/material-cards",
      "/api/review",
      "/api/sync-records",
      "/api/ai-config",
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect(
        res.status(),
        `GET ${endpoint} should return 401 without auth`
      ).toBe(401);
    }
  });

  test("未登录：admin API 全部返回 401", async ({ request }) => {
    const endpoints = [
      "/api/admin/users",
      "/api/admin/logs",
      "/api/admin/tasks",
      "/api/admin/metrics",
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect(
        res.status(),
        `GET ${endpoint} should return 401 without auth`
      ).toBe(401);
    }
  });

  test("未登录：admin mutating API 返回 401", async ({ request }) => {
    const mutations = [
      { method: "POST", url: "/api/admin/users", body: {} },
      { method: "DELETE", url: "/api/admin/logs", body: {} },
      { method: "POST", url: "/api/admin/clean", body: {} },
    ];

    for (const { method, url, body } of mutations) {
      const res = await request.fetch(url, {
        method,
        data: body,
      });
      expect(
        res.status(),
        `${method} ${url} should return 401 without auth`
      ).toBe(401);
    }
  });

  // ── Admin authenticated: API access works ────────────────────────────────────

  test("管理员：登录后可访问 content-items", async ({ request }) => {
    await loginAsAdminAPI(request);

    const res = await request.get("/api/content-items");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("管理员：登录后可访问 material-cards", async ({ request }) => {
    await loginAsAdminAPI(request);

    const res = await request.get("/api/material-cards");
    expect(res.status()).toBe(200);
  });

  test("管理员：登录后可搜索", async ({ request }) => {
    await loginAsAdminAPI(request);

    const res = await request.get("/api/search?q=test");
    expect(res.status()).toBe(200);
  });

  test("管理员：登录后可访问 review", async ({ request }) => {
    await loginAsAdminAPI(request);

    const res = await request.get("/api/review?mode=random&limit=5");
    expect(res.status()).toBe(200);
  });

  test("管理员：登录后可访问 admin 端点", async ({ request }) => {
    await loginAsAdminAPI(request);

    const usersRes = await request.get("/api/admin/users");
    expect(usersRes.status(), "GET /api/admin/users should return 200").toBe(
      200
    );

    const tasksRes = await request.get("/api/admin/tasks");
    expect(tasksRes.status(), "GET /api/admin/tasks should return 200").toBe(
      200
    );
  });

  // ── Browser-level access control ─────────────────────────────────────────────

  test("管理员：admin 页面浏览器访问正常", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Admin dashboard should show system overview
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(
      page.getByRole("heading", { name: "系统概览" })
    ).toBeVisible();

    // Admin users page should load
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);

    guard.report(testInfo);
  });

  test("未认证用户访问 admin 页面被拒绝", async ({ browser }, testInfo) => {
    // Create a fresh context without auth cookies to test unauthenticated access
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login/);

    guard.report(testInfo);
    await context.close();
  });

  test("权限矩阵：admin 页面浏览器级别权限", async ({ page }) => {
    // Admin user (via storageState) can access admin pages
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);

    // Create a fresh context WITHOUT storageState to simulate unauthenticated
    const context = await page.context().browser()!.newContext({
      storageState: undefined,
    });
    const unauthPage = await context.newPage();

    // Unauthenticated user redirected to login
    await unauthPage.goto("/admin");
    await expect(unauthPage).toHaveURL(/\/admin\/login/);

    await context.close();
  });
});
