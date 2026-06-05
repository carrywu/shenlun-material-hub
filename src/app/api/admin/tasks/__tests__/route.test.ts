import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asyncTask: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

describe("GET /api/admin/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: "task-1", status: "RUNNING" }]);
    mocks.count.mockResolvedValue(1);
  });

  it("filters by status and paginates tasks", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest("http://localhost/api/admin/tasks?status=RUNNING&page=2&pageSize=5")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: "RUNNING" },
      orderBy: { createdAt: "desc" },
      skip: 5,
      take: 5,
    });
    expect(payload).toMatchObject({
      data: [{ id: "task-1", status: "RUNNING" }],
      total: 1,
      page: 2,
      pageSize: 5,
    });
  });
});
