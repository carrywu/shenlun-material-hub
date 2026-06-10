import { afterEach, describe, expect, it } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalBaseUrl = process.env.WEWERSS_BASE_URL;
const originalPublicUrl = process.env.NEXT_PUBLIC_WEWERSS_PUBLIC_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalBaseUrl === undefined) delete process.env.WEWERSS_BASE_URL;
  else process.env.WEWERSS_BASE_URL = originalBaseUrl;
  if (originalPublicUrl === undefined) delete process.env.NEXT_PUBLIC_WEWERSS_PUBLIC_URL;
  else process.env.NEXT_PUBLIC_WEWERSS_PUBLIC_URL = originalPublicUrl;
});

describe("WeWeRSS runtime config", () => {
  it("allows localhost fallback in development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.WEWERSS_BASE_URL;
    const { getWeweRssServerConfig } = await import("../wewe-rss-config");

    expect(getWeweRssServerConfig()).toEqual({
      configured: true,
      baseUrl: "http://localhost:4000",
    });
  });

  it("does not silently default to localhost in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.WEWERSS_BASE_URL;
    const { getWeweRssServerConfig } = await import("../wewe-rss-config");

    expect(getWeweRssServerConfig()).toEqual({
      configured: false,
      code: "WEWERSS_CONFIG_MISSING",
      message: "未配置 WeWeRSS 服务地址",
    });
  });

  it("returns the configured browser public URL", async () => {
    process.env.NEXT_PUBLIC_WEWERSS_PUBLIC_URL = " http://47.119.182.210/wewerss/ ";
    const { getWeweRssPublicConfig } = await import("../wewe-rss-config");

    expect(getWeweRssPublicConfig()).toEqual({
      configured: true,
      publicUrl: "http://47.119.182.210/wewerss",
    });
  });
});
