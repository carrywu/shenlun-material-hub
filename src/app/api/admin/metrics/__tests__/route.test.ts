import { beforeEach, describe, expect, it, vi } from "vitest";

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
    const response = await GET();
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
