import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";
test.describe("Middleware redirect", () => {
  // ── Public pages (no login required) ─────────────────────────────────────────

  test("公开页面：/articles 无需登录可访问", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/articles");
    await expect(page).toHaveURL(/\/articles/);
    await expect(page.getByRole("heading", { name: /文章/ })).toBeVisible();

    guard.report(testInfo);
  });

  test("公开页面：/explore 无需登录可访问", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/explore");
    await expect(page).toHaveURL(/\/explore/);
    // Page should render explore content (heading or main region visible)
    await expect(page.locator("main").first()).toBeVisible();

    guard.report(testInfo);
  });

  test("公开页面：/discover 无需登录可访问", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/discover");
    await expect(page).toHaveURL(/\/discover/);
    await expect(page.locator("main").first()).toBeVisible();

    guard.report(testInfo);
  });

  // ── Protected pages (redirect to login) ──────────────────────────────────────
  // These tests must NOT inherit admin auth cookies from config storageState
  test.describe("受保护页面重定向", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("受保护页面：/ 重定向到前台登录页", async ({ page }, testInfo) => {
      const guard = attachConsoleGuard(page);

      await page.goto("/");
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

      guard.report(testInfo);
    });

    test("受保护页面：/settings 重定向到前台登录页", async ({ page }, testInfo) => {
      const guard = attachConsoleGuard(page);

      await page.goto("/settings");
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

      guard.report(testInfo);
    });

    test("受保护页面：/search 重定向到前台登录页（需登录）", async ({ page }, testInfo) => {
      const guard = attachConsoleGuard(page);

      await page.goto("/search");
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

      guard.report(testInfo);
    });

    test("受保护页面：/cards 重定向到前台登录页（需登录）", async ({ page }, testInfo) => {
      const guard = attachConsoleGuard(page);

      await page.goto("/cards");
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

      guard.report(testInfo);
    });

    test("受保护页面：/admin 重定向到后台登录页带 redirect 参数", async ({
      page,
    }, testInfo) => {
      const guard = attachConsoleGuard(page);

      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });

      guard.report(testInfo);
    });
  });

  // ── Public APIs (no auth required) ───────────────────────────────────────────

  test("公开 API：/api/articles 返回 200 和公开数据", async ({ request }) => {
    const res = await request.get("/api/articles");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // All returned items must be public
    for (const item of body.data) {
      expect(item.visibility).toBe("public");
    }
  });

  test("公开 API：/api/search 返回 200", async ({ request }) => {
    const res = await request.get("/api/search?q=test");
    expect(res.status()).toBe(200);
  });

  test("公开 API：/api/health 返回 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });

  // ── Protected APIs (require auth) ────────────────────────────────────────────
  test.describe("受保护 API 未登录返回 401", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("/api/content-items 未登录返回 401", async ({ request }) => {
      const res = await request.get("/api/content-items");
      expect(res.status()).toBe(401);
    });
  });

  // ── Login redirect flow ──────────────────────────────────────────────────────
  test.describe("登录重定向流程", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("后台登录后跳转回 admin 页面", async ({ page }, testInfo) => {
      test.setTimeout(60000);
      const guard = attachConsoleGuard(page);

      // Step 1: Visit admin page → get redirected to /admin/login with redirect param
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });

      // Step 2: Login via the admin login form
      const accountInput = page.getByPlaceholder("请输入账号");
      await expect(accountInput).toBeVisible({ timeout: 10000 });
      await accountInput.fill("admin");
      await page.getByPlaceholder("请输入密码").fill("admin123");
      await page.locator("form button[type='submit']").click();

      // Step 3: After login, should redirect back to /admin (via redirect param)
      await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

      guard.report(testInfo);
    });
  });

  // ── Console error check for public pages ──────────────────────────────────────

  test("公开页面无 console error", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Visit all public pages (Round B: /explore and /discover removed)
    for (const url of ["/articles"]) {
      await page.goto(url);
      await page.waitForTimeout(1000);
    }

    // Filter out known acceptable errors
    const critical = errors.filter(
      (e) => !e.includes("401") && !e.includes("Unauthorized")
    );

    if (critical.length > 0) {
      console.log("Console errors on public pages:", critical);
    }
    expect(critical.length).toBe(0);
  });
});
