import { http, HttpResponse, delay } from "msw";

/**
 * Auth API mock handlers.
 * Covers: /api/auth/{login,check,register,logout,change-password,upgrade}
 */

// ─── Shared fixtures ───

const MOCK_USERS = new Map([
  [
    "admin",
    {
      id: "mock-admin-id",
      username: "admin",
      role: "ADMIN",
      displayName: "管理员",
    },
  ],
  [
    "user",
    {
      id: "mock-user-id",
      username: "user",
      role: "USER",
      displayName: "普通用户",
    },
  ],
  [
    "verified",
    {
      id: "mock-verified-id",
      username: "verified",
      role: "VERIFIED_USER",
      displayName: "认证用户",
    },
  ],
]);

// Track "authenticated" user across handlers (jsdom has no real cookie jar)
let currentAuthUser: (typeof MOCK_USERS extends Map<string, infer V> ? V : never) | null = null;

export function setAuthUser(username: string | null) {
  currentAuthUser = username ? MOCK_USERS.get(username) ?? null : null;
}

export function getAuthUser() {
  return currentAuthUser;
}

export function resetAuthUser() {
  currentAuthUser = null;
}

// ─── Handlers ───

export const authHandlers = [
  // POST /api/auth/login
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    const { username, password } = body;

    // Rate limit simulation
    if (username === "rate-limited") {
      return HttpResponse.json(
        { error: "登录尝试过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const user = MOCK_USERS.get(username);
    if (!user || password !== "password123") {
      return HttpResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // Admin context check
    if (body.context === "admin" && user.role !== "ADMIN") {
      return HttpResponse.json(
        { error: "该账号无后台管理权限" },
        { status: 403 }
      );
    }

    currentAuthUser = user;
    return HttpResponse.json({
      success: true,
      message: "登录成功",
      user: { username: user.username, role: user.role, displayName: user.displayName },
    });
  }),

  // GET /api/auth/check
  http.get("/api/auth/check", () => {
    if (!currentAuthUser) {
      return HttpResponse.json({ authenticated: false }, { status: 401 });
    }
    return HttpResponse.json({
      authenticated: true,
      username: currentAuthUser.username,
      role: currentAuthUser.role,
      displayName: currentAuthUser.displayName,
    });
  }),

  // POST /api/auth/register
  http.post("/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    const { username } = body;

    if (MOCK_USERS.has(username)) {
      return HttpResponse.json({ error: "用户名已存在" }, { status: 409 });
    }

    if (!username || username.length < 3) {
      return HttpResponse.json(
        { error: "用户名至少3个字符" },
        { status: 400 }
      );
    }

    const newUser = {
      id: `mock-${username}-id`,
      username,
      role: "USER" as const,
      displayName: username,
    };
    MOCK_USERS.set(username, newUser);
    currentAuthUser = newUser;

    return HttpResponse.json(
      {
        success: true,
        message: "注册成功",
        user: { username: newUser.username, role: newUser.role },
      },
      { status: 201 }
    );
  }),

  // POST /api/auth/logout
  http.post("/api/auth/logout", () => {
    currentAuthUser = null;
    return HttpResponse.json({ success: true, message: "注销成功" });
  }),

  // POST /api/auth/change-password
  http.post("/api/auth/change-password", async ({ request }) => {
    if (!currentAuthUser) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, string>;
    if (body.currentPassword !== "password123") {
      return HttpResponse.json({ error: "当前密码不正确" }, { status: 400 });
    }
    return HttpResponse.json({ success: true, message: "密码修改成功" });
  }),

  // POST /api/auth/upgrade
  http.post("/api/auth/upgrade", async ({ request }) => {
    if (!currentAuthUser) {
      return HttpResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (currentAuthUser.role !== "USER") {
      return HttpResponse.json({ error: "仅普通用户可升级" }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, string>;
    if (body.invitationCode !== "VALID-CODE") {
      return HttpResponse.json({ error: "邀请码无效" }, { status: 400 });
    }
    currentAuthUser = { ...currentAuthUser, role: "VERIFIED_USER" };
    return HttpResponse.json({
      success: true,
      message: "升级成功",
      role: "VERIFIED_USER",
    });
  }),
];
