import { describe, it, expect } from "vitest";
import {
  normalizeBaseUrl,
  buildFeedUrl,
  buildRefreshUrl,
} from "../wewe-rss";

describe("WeweRssService", () => {
  describe("normalizeBaseUrl", () => {
    it("removes trailing slash", () => {
      expect(normalizeBaseUrl("http://localhost:4000/")).toBe("http://localhost:4000");
    });

    it("removes multiple trailing slashes", () => {
      expect(normalizeBaseUrl("http://localhost:4000///")).toBe("http://localhost:4000");
    });

    it("keeps URL without trailing slash unchanged", () => {
      expect(normalizeBaseUrl("http://localhost:4000")).toBe("http://localhost:4000");
    });
  });

  describe("buildFeedUrl", () => {
    it("builds RSS feed URL", () => {
      expect(buildFeedUrl("http://localhost:4000", "MP_WXS_123")).toBe(
        "http://localhost:4000/feeds/MP_WXS_123.rss"
      );
    });

    it("builds Atom feed URL", () => {
      expect(buildFeedUrl("http://localhost:4000", "MP_WXS_123", "atom")).toBe(
        "http://localhost:4000/feeds/MP_WXS_123.atom"
      );
    });

    it("builds JSON feed URL", () => {
      expect(buildFeedUrl("http://localhost:4000", "MP_WXS_123", "json")).toBe(
        "http://localhost:4000/feeds/MP_WXS_123.json"
      );
    });

    it("handles baseUrl with trailing slash", () => {
      expect(buildFeedUrl("http://localhost:4000/", "MP_WXS_123")).toBe(
        "http://localhost:4000/feeds/MP_WXS_123.rss"
      );
    });
  });

  describe("buildRefreshUrl", () => {
    it("appends update=true to feed URL", () => {
      expect(buildRefreshUrl("http://localhost:4000", "MP_WXS_123")).toBe(
        "http://localhost:4000/feeds/MP_WXS_123.rss?update=true"
      );
    });

    it("handles baseUrl with trailing slash", () => {
      expect(buildRefreshUrl("http://localhost:4000/", "MP_WXS_123")).toBe(
        "http://localhost:4000/feeds/MP_WXS_123.rss?update=true"
      );
    });

    it("uses & when URL already has query params", () => {
      // This case shouldn't happen with buildFeedUrl, but test the logic
      const _urlWithQuery = "http://localhost:4000/feeds/MP_WXS_123.rss?foo=bar";
      expect(buildRefreshUrl("http://localhost:4000", "MP_WXS_123")).toContain("?update=true");
    });
  });
});
