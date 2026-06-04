import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

import { GET } from "../route";

describe("GET /api/articles route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it("should not filter by platform when sourceType is not provided or is all", async () => {
    const req1 = new NextRequest("http://localhost/api/articles");
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {},
      })
    );

    const req2 = new NextRequest("http://localhost/api/articles?sourceType=all");
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it("should filter by platform=website when sourceType=website", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=website");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: "website",
        }),
      })
    );
  });

  it("should filter by platform=wechat when sourceType=wechat", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=wechat");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: "wechat",
        }),
      })
    );
  });

  it("should filter by platform not in website/wechat when sourceType=unknown", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=unknown");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: { notIn: ["website", "wechat"] },
        }),
      })
    );
  });

  it("should combine sourceType and sourceId filters when both are provided", async () => {
    const req = new NextRequest("http://localhost/api/articles?sourceType=website&sourceId=src-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: "website",
          sourceId: "src-1",
        }),
      })
    );
  });
});
