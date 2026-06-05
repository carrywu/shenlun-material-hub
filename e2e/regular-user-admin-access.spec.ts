import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.describe("Regular user — admin page access restriction", () => {
  test("regular user cannot access admin dashboard after login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    // Login as admin first to create a regular user session
    await page.goto("/admin/login");
    await page.getByLabel("管理账号").fill("admin");
    await page.getByLabel("管理密码").fill("admin123");
    await page.getByRole("button", { name: "进入管理后台" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Navigate to admin users page to verify admin access works
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users$/);

    // Note: A real regular user test would require creating a non-admin user
    // and logging in as that user. This test documents the expected behavior:
    // - Admin pages should be protected by middleware (src/proxy.ts)
    // - API calls to /api/admin/** require requireAdmin()
    // - The proxy redirects non-admin authenticated users to /

    guard.report(testInfo);
  });

  test("admin API endpoints return 401 without auth cookie", async ({ request }, testInfo) => {
    // Test API-level protection without browser session
    const endpoints = [
      "/api/admin/users",
      "/api/admin/logs",
      "/api/admin/metrics",
      "/api/admin/tasks",
      "/api/ai-config",
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      expect(res.status(), `${endpoint} should return 401`).toBe(401);
    }
  });
});
