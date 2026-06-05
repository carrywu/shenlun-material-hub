import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock fetch to control external HTTP requests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Image Proxy — SSRF protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should reject localhost URLs", async () => {
    const { GET } = await import("@/app/api/proxy/image/route");
    const req = new NextRequest("http://localhost/api/proxy/image?url=http://localhost:3000/secret");
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("should reject private IP addresses", async () => {
    const { GET } = await import("@/app/api/proxy/image/route");
    const req = new NextRequest("http://localhost/api/proxy/image?url=http://192.168.1.1/secret");
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("should reject non-whitelisted domains", async () => {
    const { GET } = await import("@/app/api/proxy/image/route");
    const req = new NextRequest("http://localhost/api/proxy/image?url=https://evil.com/image.png");
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("should reject HTTP (non-HTTPS) URLs for non-localhost", async () => {
    const { GET } = await import("@/app/api/proxy/image/route");
    const req = new NextRequest("http://localhost/api/proxy/image?url=http://mmbiz.qpic.cn/image.png");
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("should reject request without url parameter", async () => {
    const { GET } = await import("@/app/api/proxy/image/route");
    const req = new NextRequest("http://localhost/api/proxy/image");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
