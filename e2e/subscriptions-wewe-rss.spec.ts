import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.describe("Admin sources and WeWe RSS integration", () => {
  test("loads admin source management pages without list key warnings", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/login");
    await page.getByLabel("管理账号").fill("admin");
    await page.getByLabel("管理密码").fill("admin123");
    await page.getByRole("button", { name: "进入管理后台" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/sources");
    await expect(page.locator("h1.text-xl.font-semibold", { hasText: "来源管理" })).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.goto("/admin/integrations/wewe-rss");
    await expect(page.getByRole("heading", { name: "WeWe RSS 集成", level: 1 })).toBeVisible({
      timeout: 10000,
    });

    guard.report(testInfo);
  });
});
