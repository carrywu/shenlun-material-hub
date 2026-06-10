import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

describe("GET /api/health", () => {
  it("returns ok when database responds", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const { GET } = await import("../route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, database: "ok" });
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it("returns 503 when database is unavailable", async () => {
    dbMock.$queryRaw.mockRejectedValueOnce(new Error("database down"));
    const { GET } = await import("../route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, database: "error" });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});
