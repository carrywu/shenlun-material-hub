import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.describe("Middleware redirect", () => {
  test("anonymous /articles is accessible without login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/articles");
    // Should NOT redirect to login — /articles is a public page
    await expect(page).toHaveURL(/\/articles$/);
    // Page should render article list content (not login form)
    await expect(page.getByRole("heading", { name: /文章/ })).toBeVisible();

    guard.report(testInfo);
  });

  test("anonymous /sources redirects to login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/sources");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "申论素材采集台" })).toBeVisible();

    guard.report(testInfo);
  });

  test("anonymous / redirects to login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/");
    await expect(page).toHaveURL(/\/admin\/login/);

    guard.report(testInfo);
  });

  test("anonymous /search redirects to login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/search");
    await expect(page).toHaveURL(/\/admin\/login/);

    guard.report(testInfo);
  });

  test("anonymous /api/articles returns only public content", async ({ request }) => {
    const res = await request.get("/api/articles");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // All returned items should be public
    for (const item of body.data) {
      expect(item.visibility).toBe("public");
    }
  });

  test("anonymous /api/content-items returns 401", async ({ request }) => {
    const res = await request.get("/api/content-items");
    expect(res.status()).toBe(401);
  });

  test("anonymous /api/search returns 401", async ({ request }) => {
    const res = await request.get("/api/search?q=test");
    expect(res.status()).toBe(401);
  });

  test("login then access protected pages", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    // Login as admin — use placeholder-based selectors matching the actual login page
    await page.goto("/admin/login");
    const accountInput = page.getByPlaceholder("请输入账号");
    await expect(accountInput).toBeVisible({ timeout: 30000 });
    await accountInput.fill("admin");
    await page.getByPlaceholder("请输入密码").fill("admin123");
    // Use form-specific button selector to avoid matching nav "登录" link
    await page.locator("form button[type='submit']").click();
    // Login redirects to homepage (not /admin)
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // Now access a protected page — should work
    await page.goto("/sources");
    await expect(page).toHaveURL(/\/sources$/);

    // Access articles — should also work
    await page.goto("/articles");
    await expect(page).toHaveURL(/\/articles$/);

    guard.report(testInfo);
  });
});
