import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArticleExportMenu } from "@/components/articles/ArticleExportMenu";

// Minimal article shape the menu needs to build export content.
const article = {
  id: "a1",
  title: "推进基层治理现代化",
  originalUrl: "https://example.com/a",
  platform: "wechat",
  source: { id: "s1", name: "人民日报", platform: "wechat" },
  fullText: "推进基层治理现代化。",
  rawHtml: "<p>推进基层治理现代化。</p>",
  excerpt: "摘要",
  contentType: "commentary",
  publishedAt: "2026-06-20T00:00:00.000Z",
  annotations: [],
};

describe("ArticleExportMenu", () => {
  it("renders a trigger button with stable test id and aria-label", () => {
    render(<ArticleExportMenu article={article as never} />);
    expect(screen.getByTestId("article-export-menu")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /导出/ })
    ).toBeTruthy();
  });

  it("opens the menu and exposes all four export options with stable test ids", () => {
    render(<ArticleExportMenu article={article as never} />);
    fireEvent.click(screen.getByTestId("article-export-menu"));

    expect(screen.getByTestId("article-export-pdf-clean")).toBeTruthy();
    expect(screen.getByTestId("article-export-pdf-annotated")).toBeTruthy();
    expect(screen.getByTestId("article-export-word-clean")).toBeTruthy();
    expect(screen.getByTestId("article-export-word-annotated")).toBeTruthy();
  });

  it("enters pending state on the trigger while an export is in progress", async () => {
    render(<ArticleExportMenu article={article as never} />);
    fireEvent.click(screen.getByTestId("article-export-menu"));
    // trigger a word export (resolves async); the trigger button should be pending
    fireEvent.click(screen.getByTestId("article-export-word-clean"));
    const trigger = screen.getByTestId("article-export-menu") as HTMLButtonElement;
    // pending is set synchronously when the export starts
    expect(
      trigger.disabled || trigger.getAttribute("data-pending") === "true"
    ).toBe(true);
    // a second open attempt must not be possible while pending (trigger disabled)
    expect(trigger.disabled).toBe(true);
  });

  it("disables the trigger when body has no exportable text", () => {
    const empty = { ...article, fullText: "", rawHtml: "" };
    render(<ArticleExportMenu article={empty as never} />);
    const trigger = screen.getByTestId("article-export-menu") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});
