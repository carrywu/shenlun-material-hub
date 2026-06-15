import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.use({ storageState: ".auth/admin-storage.json" });

test.describe("后台用户身份管理", () => {
  test("管理员可以通过确认弹窗升级用户身份", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    const username = `e2e_role_${Date.now()}`;

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "创建用户" }).click();
    await page.getByPlaceholder("3-32 个字符").fill(username);
    await page.getByPlaceholder("至少 6 个字符").fill("role123456");
    await page.getByRole("button", { name: "创建" }).click();
    await expect(page.getByText(new RegExp(`用户 "${username}" 创建成功`))).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: username });
    await expect(row).toBeVisible();
    await row.getByRole("combobox", { name: `调整 ${username} 身份` }).click();
    await page.getByRole("option", { name: "认证用户" }).click();

    await expect(page.getByRole("dialog", { name: "确认调整用户身份" })).toBeVisible();
    await expect(page.getByText(`确定将 ${username} 的身份调整为「认证用户」吗？`)).toBeVisible();
    await page.getByRole("button", { name: "确认调整" }).click();

    await expect(page.getByText(`已将 ${username} 的身份调整为认证用户`)).toBeVisible();
    await expect(row.getByRole("combobox", { name: `调整 ${username} 身份` })).toContainText("认证用户");

    guard.report(testInfo);
  });
});
