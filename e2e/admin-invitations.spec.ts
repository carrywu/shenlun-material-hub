import { test, expect } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.use({ storageState: ".auth/admin-storage.json" });

test.describe("后台邀请码管理", () => {
  test("管理员可以打开邀请码管理页", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/invitations");
    await expect(page.getByTestId('admin-invitations-page-header')).toBeVisible();
    await expect(page.getByRole("button", { name: "创建邀请码" })).toBeVisible();

    guard.report(testInfo);
  });

  test("创建邀请码后列表展示新邀请码", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/invitations");
    await page.getByRole("button", { name: "创建邀请码" }).click();
    await page.getByLabel("最大使用次数").fill("2");
    await page.getByRole("button", { name: "确认创建" }).click();
    await expect(page.getByText(/邀请码已创建/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "已用 0 次，剩余 2 次" }).first()).toBeVisible();

    guard.report(testInfo);
  });

  test("管理员可以作废邀请码", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/invitations");
    await page.getByRole("button", { name: "创建邀请码" }).click();
    await page.getByRole("button", { name: "确认创建" }).click();
    await expect(page.getByText(/邀请码已创建/)).toBeVisible();
    await page.getByRole("button", { name: "作废" }).first().click();
    await page.getByRole("button", { name: "确认作废" }).click();
    await expect(page.getByText("已作废").first()).toBeVisible();

    guard.report(testInfo);
  });
});
