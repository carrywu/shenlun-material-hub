import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock fetch to control external HTTP requests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Helper: build a proxy request with the given `url` query parameter.
 */
function proxyRequest(imageUrl: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/proxy/image?url=${encodeURIComponent(imageUrl)}`
  );
}

/**
 * Helper: parse JSON body from a NextResponse.
 */
async function responseBody(res: Response) {
  return res.json();
}

describe("Image Proxy — SSRF protection", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── Allowed: whitelisted WeChat CDN domains ───────────────────────

  describe("whitelisted domains", () => {
    const whitelisted = [
      "https://mmbiz.qpic.cn/mmbiz_png/test/123",
      "https://wx.qpic.cn/mmbiz_png/test/456",
      "https://mmbiz.qlogo.cn/mmbiz_png/test/789",
    ];

    whitelisted.forEach((url) => {
      it(`should allow ${new URL(url).hostname}`, async () => {
        const { GET } = await import("@/app/api/proxy/image/route");
        mockFetch.mockResolvedValueOnce(
          new Response(new ArrayBuffer(8), {
            status: 200,
            headers: { "content-type": "image/png" },
          })
        );
        const res = await GET(proxyRequest(url));
        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledWith(
          url,
          expect.objectContaining({
            headers: expect.objectContaining({
              Referer: "https://mp.weixin.qq.com/",
            }),
          })
        );
      });
    });

    it("should allow subdomains of whitelisted domains", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const url = "https://sub.mmbiz.qpic.cn/mmbiz_png/test.png";
      mockFetch.mockResolvedValueOnce(
        new Response(new ArrayBuffer(8), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      );
      const res = await GET(proxyRequest(url));
      expect(res.status).toBe(200);
    });

    it("should return correct content-type and cache headers on success", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockResolvedValueOnce(
        new Response(new ArrayBuffer(4), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      );
      const res = await GET(
        proxyRequest("https://mmbiz.qpic.cn/test.jpg")
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
      expect(res.headers.get("X-Proxy-Source")).toBe("wechat-cdn");
    });
  });

  // ─── Rejected: non-whitelisted domains ──────────────────────────────

  describe("non-whitelisted domains", () => {
    const forbidden = [
      "https://evil.com/image.png",
      "https://example.com/pic.jpg",
      "https://mmbiz.qpic.cn.evil.com/fake.png",
      "https://attacker.com/mmbiz.qpic.cn",
    ];

    forbidden.forEach((url) => {
      const trimmed = url.trim();
      it(`should reject ${new URL(trimmed).hostname}`, async () => {
        const { GET } = await import("@/app/api/proxy/image/route");
        const res = await GET(proxyRequest(trimmed));
        expect(res.status).toBe(403);
        const body = await responseBody(res);
        expect(body.error).toMatch(/白名单|域名不在白名单/);
      });
    });
  });

  // ─── Rejected: private / loopback IP addresses ─────────────────────

  describe("private IP addresses (SSRF prevention)", () => {
    const privateUrls = [
      ["127.0.0.1", "https://127.0.0.1/secret"],
      ["127.0.0.2", "https://127.0.0.2/secret"],
      ["10.0.0.1", "https://10.0.0.1/secret"],
      ["10.255.255.255", "https://10.255.255.255/secret"],
      ["192.168.0.1", "https://192.168.0.1/secret"],
      ["192.168.1.100", "https://192.168.1.100/secret"],
      ["172.16.0.1", "https://172.16.0.1/secret"],
      ["172.31.255.255", "https://172.31.255.255/secret"],
    ];

    privateUrls.forEach(([label, url]) => {
      it(`should reject ${label}`, async () => {
        const { GET } = await import("@/app/api/proxy/image/route");
        const res = await GET(proxyRequest(url));
        expect(res.status).toBe(403);
        const body = await responseBody(res);
        expect(body.error).toMatch(/私有|私有地址/);
      });
    });

    it("should reject 172.15.x.x edge case (NOT private)", async () => {
      // 172.15.x.x is NOT in the private range (172.16-31), but it is also
      // not whitelisted, so it should still be rejected — just not with the
      // private IP message.
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("https://172.15.0.1/secret"));
      expect(res.status).toBe(403);
      const body = await responseBody(res);
      // Should be domain whitelist rejection, not private IP rejection
      expect(body.error).toMatch(/白名单|域名不在白名单/);
    });

    it("should reject 172.32.x.x (just above private range)", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("https://172.32.0.1/secret"));
      expect(res.status).toBe(403);
      const body = await responseBody(res);
      expect(body.error).toMatch(/白名单|域名不在白名单/);
    });
  });

  // ─── Rejected: localhost ────────────────────────────────────────────

  describe("localhost", () => {
    it("should reject localhost hostname", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(
        proxyRequest("https://localhost:3000/secret")
      );
      expect(res.status).toBe(403);
      const body = await responseBody(res);
      expect(body.error).toMatch(/私有|私有地址/);
    });
  });

  // ─── Rejected: HTTP (non-HTTPS) protocol ────────────────────────────

  describe("protocol enforcement", () => {
    it("should reject HTTP URLs even for whitelisted domains", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(
        proxyRequest("http://mmbiz.qpic.cn/image.png")
      );
      expect(res.status).toBe(403);
      const body = await responseBody(res);
      expect(body.error).toMatch(/HTTPS/);
    });
  });

  // ─── Rejected: missing or invalid url parameter ─────────────────────

  describe("missing / invalid url parameter", () => {
    it("should reject request without url parameter", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const req = new NextRequest("http://localhost/api/proxy/image");
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await responseBody(res);
      expect(body.error).toMatch(/url/);
    });

    it("should reject empty url parameter", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const req = new NextRequest("http://localhost/api/proxy/image?url=");
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it("should reject malformed URL", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("not-a-valid-url"));
      expect(res.status).toBe(403);
      const body = await responseBody(res);
      expect(body.error).toMatch(/无效/);
    });
  });

  // ─── Upstream error handling ────────────────────────────────────────

  describe("upstream errors", () => {
    it("should return 502 when upstream returns non-OK status", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );
      const res = await GET(
        proxyRequest("https://mmbiz.qpic.cn/missing.png")
      );
      expect(res.status).toBe(502);
      const body = await responseBody(res);
      expect(body.error).toMatch(/上游返回 404/);
    });

    it("should return 502 when upstream returns 500", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );
      const res = await GET(
        proxyRequest("https://mmbiz.qpic.cn/error.png")
      );
      expect(res.status).toBe(502);
      const body = await responseBody(res);
      expect(body.error).toMatch(/上游返回 500/);
    });

    it("should return 502 when fetch throws", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockRejectedValueOnce(new Error("network timeout"));
      const res = await GET(
        proxyRequest("https://mmbiz.qpic.cn/timeout.png")
      );
      expect(res.status).toBe(502);
      const body = await responseBody(res);
      expect(body.error).toBe("network timeout");
    });
  });

  // ─── Additional SSRF vectors ──────────────────────────────────────

  describe("advanced SSRF prevention", () => {
    it("should reject IPv6 loopback (::1)", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("https://[::1]/secret"));
      expect(res.status).toBe(403);
    });

    it("should allow URL with credentials on whitelisted domain", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockResolvedValueOnce(
        new Response(new ArrayBuffer(4), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      );
      const res = await GET(
        proxyRequest("https://user:pass@mmbiz.qpic.cn/image.png")
      );
      // Credentials don't change the domain — domain check passes
      expect(res.status).toBe(200);
    });

    it("should reject JavaScript protocol URLs", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("javascript:alert(1)"));
      expect(res.status).toBe(403);
    });

    it("should reject data: URIs", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(
        proxyRequest("data:image/png;base64,iVBORw0KGgo=")
      );
      expect(res.status).toBe(403);
    });

    it("should reject file:// protocol", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("file:///etc/passwd"));
      expect(res.status).toBe(403);
    });

    it("should reject 0.0.0.0", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      const res = await GET(proxyRequest("https://0.0.0.0/secret"));
      expect(res.status).toBe(403);
    });

    it("should include Referer header for WeChat CDN bypass", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockResolvedValueOnce(
        new Response(new ArrayBuffer(4), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      );
      await GET(proxyRequest("https://mmbiz.qpic.cn/test.jpg"));
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mmbiz.qpic.cn/test.jpg",
        expect.objectContaining({
          headers: expect.objectContaining({
            Referer: "https://mp.weixin.qq.com/",
          }),
        })
      );
    });

    it("should send appropriate User-Agent header", async () => {
      const { GET } = await import("@/app/api/proxy/image/route");
      mockFetch.mockResolvedValueOnce(
        new Response(new ArrayBuffer(4), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      );
      await GET(proxyRequest("https://mmbiz.qpic.cn/test.jpg"));
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("Mozilla"),
          }),
        })
      );
    });
  });
});
