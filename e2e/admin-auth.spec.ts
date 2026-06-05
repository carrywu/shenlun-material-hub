import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.describe("Admin auth", () => {
  test("redirects unauthenticated admin page requests to login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "申论素材采集台" })).toBeVisible();

    guard.report(testInfo);
  });

  test("rejects invalid credentials in the login form", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/login");
    await page.getByLabel("管理账号").fill("admin");
    await page.getByLabel("管理密码").fill("wrong-password");
    await page.getByRole("button", { name: "进入管理后台" }).click();

    await expect(page.getByText("用户名或密码错误")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);

    guard.report(testInfo);
  });

  test("sets auth cookie and allows access after successful login", async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto("/admin/login");
    await page.getByLabel("管理账号").fill("admin");
    await page.getByLabel("管理密码").fill("admin123");
    await page.getByRole("button", { name: "进入管理后台" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "系统概览", level: 1 })).toBeVisible();

    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === "auth_token" && cookie.httpOnly)).toBe(true);

    await page.goto("/admin/tasks");
    await expect(page).toHaveURL(/\/admin\/tasks$/);
    await expect(page.getByRole("heading", { name: "异步任务", level: 2 })).toBeVisible();

    guard.report(testInfo);
  });
});
