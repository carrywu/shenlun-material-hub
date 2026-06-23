import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("legacy route redirects", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it.each([
    [
      "/integrations/wewe-rss",
      () => import("../integrations/wewe-rss/page"),
      "/admin/integrations/wechat-rss",
    ],
    [
      "/admin/integrations/wewe-rss",
      () => import("../admin/integrations/wewe-rss/page"),
      "/admin/integrations/wechat-rss",
    ],
    ["/subscriptions", () => import("../subscriptions/page"), "/admin/sources"],
    ["/sync-records", () => import("../sync-records/page"), "/admin/sync-records"],
  ])("%s redirects to %s", async (_route, loadPage, target) => {
    const page = await loadPage();

    expect(() => page.default()).toThrow(`redirect:${target}`);
    expect(redirectMock).toHaveBeenCalledWith(target);
  });
});
