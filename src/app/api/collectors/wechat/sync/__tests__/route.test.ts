import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockCreateAsyncTask, mockEnqueueAsyncTask } = vi.hoisted(() => ({
  mockDb: {
    source: { findUnique: vi.fn() },
  },
  mockCreateAsyncTask: vi.fn(),
  mockEnqueueAsyncTask: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/async-task", () => ({
  createAsyncTask: mockCreateAsyncTask,
  enqueueAsyncTask: mockEnqueueAsyncTask,
}));

import { POST } from "../route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/collectors/wechat/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SOURCE_RECORD = {
  id: "src-wechat-001",
  name: "测试公众号",
  platform: "wechat",
  isEnabled: true,
  baseUrl: null,
  externalId: null,
  trustLevel: "verified",
  contentType: "policy_analysis",
};

describe("POST /api/collectors/wechat/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAsyncTask.mockResolvedValue({ id: "task-001", type: "WEWE_RSS_SYNC" });
  });

  it("queues wechat sync in background and returns 202", async () => {
    mockDb.source.findUnique.mockResolvedValue(SOURCE_RECORD);

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data).toMatchObject({
      accepted: true,
      taskId: "task-001",
      status: "PENDING",
      sourceName: "测试公众号",
    });
    expect(mockCreateAsyncTask).toHaveBeenCalledWith(
      "WEWE_RSS_SYNC",
      expect.objectContaining({
        sourceId: "src-wechat-001",
        sourceName: "测试公众号",
      })
    );
    expect(mockEnqueueAsyncTask).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when sourceId is missing", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sourceId");
  });

  it("returns 404 when source does not exist", async () => {
    mockDb.source.findUnique.mockResolvedValue(null);

    const req = makeRequest({ sourceId: "nonexistent" });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 400 when source is disabled", async () => {
    mockDb.source.findUnique.mockResolvedValue({
      ...SOURCE_RECORD,
      isEnabled: false,
    });

    const req = makeRequest({ sourceId: "src-wechat-001" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("禁用");
  });
});
