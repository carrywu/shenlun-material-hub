import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkHealth — non-JSON response handling", () => {
  it("returns unreachable when server responds with text/html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        json: () => Promise.resolve([]),
      })
    );

    const { checkHealth } = await import("../wewe-rss-api");

    const result = await checkHealth("http://localhost:4000");

    expect(result.reachable).toBe(false);
    expect(result.message).toContain("非 JSON 响应");
  });

  it("returns reachable when server responds with valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve([{ id: "1", name: "测试公众号" }]),
      })
    );

    const { checkHealth } = await import("../wewe-rss-api");

    const result = await checkHealth("http://localhost:4000");

    expect(result.reachable).toBe(true);
    expect(result.feedCount).toBe(1);
  });
});

describe("listFeeds — non-JSON response handling", () => {
  it("throws Chinese error when server responds with text/html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      })
    );

    const { listFeeds } = await import("../wewe-rss-api");

    await expect(listFeeds("http://localhost:4000")).rejects.toThrow(
      "非 JSON 响应"
    );
  });

  it("returns feeds when server responds with valid JSON", async () => {
    const feeds = [
      { id: "1", name: "公众号A" },
      { id: "2", name: "公众号B" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(feeds),
      })
    );

    const { listFeeds } = await import("../wewe-rss-api");

    const result = await listFeeds("http://localhost:4000");

    expect(result).toEqual(feeds);
    expect(result).toHaveLength(2);
  });
});
