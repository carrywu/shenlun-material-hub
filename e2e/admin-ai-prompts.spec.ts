import { expect, test } from "@playwright/test";
import { attachConsoleGuard } from "./helpers/consoleGuard";

test.use({ storageState: ".auth/admin-storage.json" });

test.describe("后台 AI 默认提示词模板", () => {
  test("管理员可以编辑并恢复文章评估默认提示词", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    const customPrompt = `E2E 文章评估提示词 ${Date.now()}\n标题：{{title}}\n正文：{{content}}`;

    await page.goto("/admin/settings/ai");
    await expect(page.getByText("AI 默认提示词模板")).toBeVisible();

    const articlePrompt = page.getByTestId("prompt-template-article_evaluation");
    await expect(articlePrompt).toBeVisible();
    await articlePrompt.getByRole("textbox", { name: "文章评估提示词内容" }).fill(customPrompt);
    await articlePrompt.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("提示词已保存")).toBeVisible();
    await expect(articlePrompt.getByText("已自定义")).toBeVisible();

    await articlePrompt.getByRole("button", { name: "恢复默认" }).click();
    await expect(page.getByText("已恢复默认提示词")).toBeVisible();
    await expect(articlePrompt.getByRole("textbox", { name: "文章评估提示词内容" })).not.toHaveValue(customPrompt);

    guard.report(testInfo);
  });
});
