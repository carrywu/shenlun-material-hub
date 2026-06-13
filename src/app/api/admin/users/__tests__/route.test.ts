import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock admin user and auth mocks defined inside vi.hoisted
const { authMocks, ADMIN } = vi.hoisted(() => {
  const ADMIN = {
    id: "admin-id",
    username: "admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };
  return {
    ADMIN,
    authMocks: {
      requireAdmin: vi.fn().mockResolvedValue(ADMIN),
      unauthorizedResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "未登录或会话已过期" }), { status: 401 })
      ),
      forbiddenResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
      ),
      hashPassword: vi.fn().mockResolvedValue("$2a$12$hashedpassword"),
      revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
      countActiveAdmins: vi.fn().mockResolvedValue(2),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.requireAdmin,
  unauthorizedResponse: authMocks.unauthorizedResponse,
  forbiddenResponse: authMocks.forbiddenResponse,
  hashPassword: authMocks.hashPassword,
  revokeAllUserSessions: authMocks.revokeAllUserSessions,
  countActiveAdmins: authMocks.countActiveAdmins,
}));

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: dbMocks.findMany,
      findUnique: dbMocks.findUnique,
      create: dbMocks.create,
      update: dbMocks.update,
      delete: dbMocks.delete,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/audit-logger", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../route";
import { PUT } from "../[id]/route";
import { createAuthenticatedRequest, createAnonymousRequest } from "@/test/helpers/route-helpers";

function setMockAdmin(user: typeof ADMIN | null) {
  authMocks.requireAdmin.mockResolvedValue(user);
}

/**
 * Create an authenticated NextRequest whose json() method throws a SyntaxError,
 * simulating an empty or malformed request body.
 */
function createMalformedJsonRequest(
  url: string,
  method: string
): ReturnType<typeof createAuthenticatedRequest> {
  const req = createAuthenticatedRequest(url, ADMIN, { method });
  const originalJson = req.json.bind(req);
  vi.spyOn(req, "json").mockImplementation(() => {
    throw new SyntaxError("Unexpected end of JSON input");
  });
  // Keep reference in case we want to restore
  void originalJson;
  return req;
}

describe("POST /api/admin/users — malformed JSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockAdmin(ADMIN);
  });

  it("returns 400 when request body is empty or malformed JSON", async () => {
    const req = createMalformedJsonRequest(
      "http://localhost/api/admin/users",
      "POST"
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("请求体必须是有效 JSON");
  });

  it("does not attempt any DB operations on malformed JSON", async () => {
    const req = createMalformedJsonRequest(
      "http://localhost/api/admin/users",
      "POST"
    );
    await POST(req);
    expect(dbMocks.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.create).not.toHaveBeenCalled();
  });

  it("returns 401 before JSON parsing when not authenticated", async () => {
    setMockAdmin(null);
    const req = createAnonymousRequest(
      "http://localhost/api/admin/users",
      { method: "POST", body: "not-json" }
    );
    // Auth check runs first, so even a bad body gets 401 if not authenticated
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/admin/users/[id] — malformed JSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockAdmin(ADMIN);
  });

  it("returns 400 when request body is empty or malformed JSON", async () => {
    const req = createMalformedJsonRequest(
      "http://localhost/api/admin/users/user-id",
      "PUT"
    );
    const context = { params: Promise.resolve({ id: "user-id" }) };
    const res = await PUT(req, context);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("请求体必须是有效 JSON");
  });

  it("does not attempt any DB operations on malformed JSON", async () => {
    const req = createMalformedJsonRequest(
      "http://localhost/api/admin/users/user-id",
      "PUT"
    );
    const context = { params: Promise.resolve({ id: "user-id" }) };
    await PUT(req, context);
    expect(dbMocks.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("returns 401 before JSON parsing when not authenticated", async () => {
    setMockAdmin(null);
    const req = createAnonymousRequest(
      "http://localhost/api/admin/users/user-id",
      { method: "PUT", body: "not-json" }
    );
    const context = { params: Promise.resolve({ id: "user-id" }) };
    const res = await PUT(req, context);
    expect(res.status).toBe(401);
  });
});
