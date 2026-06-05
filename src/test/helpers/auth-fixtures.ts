import { vi } from "vitest";
import type { AuthUser } from "@/lib/auth";

/**
 * Pre-built mock users for A/B isolation testing.
 */
export const mockUsers = {
  admin: {
    id: "test-admin",
    username: "admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  },
  userA: {
    id: "user-a-id",
    username: "userA",
    role: "USER" as const,
    status: "ACTIVE" as const,
  },
  userB: {
    id: "user-b-id",
    username: "userB",
    role: "USER" as const,
    status: "ACTIVE" as const,
  },
  verifiedUser: {
    id: "verified-user-id",
    username: "verifiedUser",
    role: "VERIFIED_USER" as const,
    status: "ACTIVE" as const,
  },
  disabledUser: {
    id: "disabled-user-id",
    username: "disabledUser",
    role: "USER" as const,
    status: "DISABLED" as const,
  },
} satisfies Record<string, AuthUser>;

/**
 * Create hoisted auth mock functions.
 * Returns plain mock functions (not wrapped in vi.hoisted — caller does that).
 *
 * Usage in test files:
 *   const authMocks = createAuthMocks();
 *   vi.mock("@/lib/auth", () => createAuthMockFactory(authMocks));
 */
export function createAuthMocks() {
  return {
    requireAdmin: vi.fn().mockResolvedValue(mockUsers.admin),
    requireAuth: vi.fn().mockResolvedValue(mockUsers.admin),
    requireVerifiedUser: vi.fn().mockResolvedValue(mockUsers.admin),
    getUserFromRequest: vi.fn().mockResolvedValue(mockUsers.admin),
    unauthorizedResponse: vi.fn().mockReturnValue(
      new Response(JSON.stringify({ error: "未登录或会话已过期" }), { status: 401 })
    ),
    forbiddenResponse: vi.fn().mockReturnValue(
      new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })
    ),
  };
}

/**
 * Create the vi.mock("@/lib/auth") factory from auth mocks.
 */
export function createAuthMockFactory(mocks: ReturnType<typeof createAuthMocks>) {
  return () => ({
    requireAdmin: mocks.requireAdmin,
    requireAuth: mocks.requireAuth,
    requireVerifiedUser: mocks.requireVerifiedUser,
    getUserFromRequest: mocks.getUserFromRequest,
    unauthorizedResponse: mocks.unauthorizedResponse,
    forbiddenResponse: mocks.forbiddenResponse,
  });
}

/**
 * Switch the auth mock to return a specific user for subsequent calls.
 * Pass null to simulate unauthenticated requests.
 */
export function setMockUser(
  mocks: ReturnType<typeof createAuthMocks>,
  user: AuthUser | null
) {
  mocks.requireAuth.mockResolvedValue(user);
  mocks.getUserFromRequest.mockResolvedValue(user);
  mocks.requireAdmin.mockResolvedValue(
    user && user.role === "ADMIN" ? user : null
  );
  mocks.requireVerifiedUser.mockResolvedValue(
    user && (user.role === "ADMIN" || user.role === "VERIFIED_USER") ? user : null
  );
}
