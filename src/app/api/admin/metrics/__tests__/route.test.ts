import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  requireAuth: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  unauthorizedResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
  forbiddenResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  validateSession: vi.fn().mockResolvedValue({ id: "test-admin", username: "admin", role: "ADMIN", status: "ACTIVE" }),
  hashPassword: vi.fn().mockResolvedValue("$2a$12$hash"),
  verifyPassword: vi.fn().mockResolvedValue({ valid: true }),
  createSession: vi.fn().mockResolvedValue("test-token"),
  ensureInitialAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);

const mocks = vi.hoisted(() => ({
  countArticles: vi.fn(),
  countSources: vi.fn(),
  countTasks: vi.fn(),
  countErrors: vi.fn(),
  findLogs: vi.fn(),
  findTasks: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn(),
  statfsSync: vi.fn(),
  totalmem: vi.fn(),
  freemem: vi.fn(),
  cpus: vi.fn(),
  loadavg: vi.fn(),
  type: vi.fn(),
  release: vi.fn(),
  arch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: { count: mocks.countArticles },
    source: { count: mocks.countSources },
    asyncTask: { count: mocks.countTasks, findMany: mocks.findTasks },
    systemLog: { count: mocks.countErrors, findMany: mocks.findLogs },
    // $queryRaw is called as a tagged template literal, mock it as a function
    $queryRaw: vi.fn().mockResolvedValue([{ pg_database_size: BigInt(1048576) }]),
  },
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mocks.existsSync,
    statSync: mocks.statSync,
    statfsSync: mocks.statfsSync,
  },
}));

vi.mock("os", () => ({
  default: {
    totalmem: mocks.totalmem,
    freemem: mocks.freemem,
    cpus: mocks.cpus,
    loadavg: mocks.loadavg,
    type: mocks.type,
    release: mocks.release,
    arch: mocks.arch,
  },
}));

describe("GET /api/admin/metrics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.countArticles.mockResolvedValue(12);
    mocks.countSources.mockResolvedValue(3);
    mocks.countTasks.mockResolvedValue(2);
    mocks.countErrors.mockResolvedValue(1);
    mocks.findLogs.mockResolvedValue([]);
    mocks.findTasks.mockResolvedValue([]);
    mocks.existsSync.mockReturnValue(false);
    mocks.statfsSync.mockImplementation(() => {
      throw new Error("statfs unsupported");
    });
    mocks.totalmem.mockReturnValue(1024 * 1024 * 1024);
    mocks.freemem.mockReturnValue(512 * 1024 * 1024);
    mocks.cpus.mockReturnValue([{ model: "cpu" }, { model: "cpu" }]);
    mocks.loadavg.mockReturnValue([0, 0, 0]);
    mocks.type.mockReturnValue("Linux");
    mocks.release.mockReturnValue("6.0");
    mocks.arch.mockReturnValue("x64");
  });

  it("returns metrics without shelling out to system disk commands", async () => {
    const { GET } = await import("../route");
    const mockRequest = new Request("http://localhost/api/admin/metrics", {
      headers: { cookie: "auth_token=test-token" }
    });
    const response = await GET(mockRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dbStats).toMatchObject({
      totalArticles: 12,
      totalSources: 3,
      activeTasks: 2,
      errorLogs24h: 1,
    });
    expect(payload.systemStats.disk).toMatchObject({
      percent: 0,
      freeGb: 0,
    });
  });
});
