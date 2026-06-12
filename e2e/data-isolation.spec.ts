import { expect, test, type APIRequestContext } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";
import { loginAsAdminAPI } from "./helpers/auth";

test.describe("API 数据隔离与权限 — 未认证 401", () => {
  // P0-004 (B3): 显式匿名——确保未登录用例不带任何 cookie
  test.use({ storageState: { cookies: [], origins: [] } });

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
});

test.describe("API 数据隔离与权限 — 管理员", () => {
  // P0-004 (B3): 管理员 API/页面用例需 admin storageState（API 用例仍保留 loginAsAdminAPI）
  test.use({ storageState: ".auth/admin-storage.json" });

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

// ── P0-004 Task 3 Part E: userA / userB 数据隔离 ──────────────────────────────

const FIXTURE_URL = "https://example.com/e2e-fixture-isolation-article";

/** 用 admin 身份查 fixture 文章 id（list 接口） */
async function getFixtureArticleId(
  request: APIRequestContext,
): Promise<string> {
  const res = await request.get("/api/content-items?pageSize=200");
  expect(res.ok(), `list failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const items = body.data ?? [];
  const found = items.find(
    (i: { originalUrl?: string }) => i.originalUrl === FIXTURE_URL,
  );
  if (!found)
    throw new Error("fixture 文章未找到——global-setup 是否创建了？");
  return found.id;
}

test.describe("P0-004: userA/userB 数据隔离", () => {
  // admin 身份用于查找 fixture 文章；userA/userB 各自通过 newContext 隔离
  test.use({ storageState: ".auth/admin-storage.json" });

  test("userA 收藏的文章不出现在 userB 的收藏列表", async ({
    request: adminRequest,
    playwright,
  }) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

    // 1. admin 拿 fixture 文章 id
    const articleId = await getFixtureArticleId(adminRequest);

    // 2. userA 收藏
    const userACtx = await playwright.request.newContext({
      storageState: ".auth/usera-storage.json",
      baseURL,
    });
    try {
      const favRes = await userACtx.post("/api/favorites", {
        data: { contentItemIds: [articleId] },
      });
      expect(
        favRes.ok(),
        `userA 收藏失败: ${favRes.status()} ${await favRes.text()}`,
      ).toBeTruthy();

      // 3. userB 列表不含该文章
      const userBCtx = await playwright.request.newContext({
        storageState: ".auth/userb-storage.json",
        baseURL,
      });
      try {
        const listRes = await userBCtx.get("/api/favorites");
        expect(listRes.ok()).toBeTruthy();
        const list = await listRes.json();
        const ids = (list.data ?? []).map(
          (f: { contentItemId?: string; id?: string }) =>
            f.contentItemId ?? f.id,
        );
        expect(ids, "userB 不应看到 userA 的收藏").not.toContain(articleId);
      } finally {
        await userBCtx.dispose();
      }

      // 4. 清理：userA 取消收藏（幂等，避免污染下次）
      await userACtx
        .delete(`/api/favorites/${articleId}`)
        .catch(() => {});
    } finally {
      await userACtx.dispose();
    }
  });

  test("userA 的素材卡 userB 在文章详情看不到（P0-001 e2e 兜底）", async ({
    request: adminRequest,
    playwright,
  }) => {
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

    const articleId = await getFixtureArticleId(adminRequest);

    // P0-001 尚未实现——无法在 e2e 中直接插入素材卡（需 DB seed 或真实 AI 生成）。
    // 当前基线：确认两端均能访问 fixture 文章详情且 materialCards 为空。
    // P0-001 完成后，此测试应加强为：userA 插卡 → userB 不可见。
    const userACtx = await playwright.request.newContext({
      storageState: ".auth/usera-storage.json",
      baseURL,
    });
    const userBCtx = await playwright.request.newContext({
      storageState: ".auth/userb-storage.json",
      baseURL,
    });
    try {
      const detailResA = await userACtx.get(
        `/api/content-items/${articleId}`,
      );
      const detailResB = await userBCtx.get(
        `/api/content-items/${articleId}`,
      );

      // 两边都应能访问 fixture 文章（approved public）
      expect(
        detailResA.ok(),
        `userA 详情失败: ${detailResA.status()}`,
      ).toBeTruthy();
      expect(
        detailResB.ok(),
        `userB 详情失败: ${detailResB.status()}`,
      ).toBeTruthy();

      // 基线：都无卡时 materialCards 为空（P0-001 修完后这个断言仍成立）
      const bodyA = await detailResA.json();
      const bodyB = await detailResB.json();
      expect(bodyA.materialCards ?? []).toEqual([]);
      expect(bodyB.materialCards ?? []).toEqual([]);
    } finally {
      await userACtx.dispose();
      await userBCtx.dispose();
    }
  });
});
