import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  verifyPassword,
  hashPassword,
  createSession,
  buildCookieHeader,
  ensureInitialAdmin,
  cleanExpiredSessions,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-logger";

// ─── Brute-force rate limiting ────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL = 100; // Clean up stale entries every N requests
let cleanupCounter = 0;

function getClientKey(req: NextRequest): string {
  // Use IP from headers (behind proxy) or fallback
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `login:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const entry = loginAttempts.get(key);
  if (!entry) return { allowed: true, retryAfterMs: 0 };

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - Date.now() };
  }

  // Lockout expired, reset
  if (entry.lockedUntil) {
    loginAttempts.delete(key);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }

  return { allowed: true, retryAfterMs: 0 };
}

function recordFailedAttempt(key: string): void {
  const entry = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count++;
  loginAttempts.set(key, entry);
}

function recordSuccess(key: string): void {
  loginAttempts.delete(key);
}

function cleanupStaleEntries(): void {
  cleanupCounter++;
  if (cleanupCounter < CLEANUP_INTERVAL) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (entry.lockedUntil && now > entry.lockedUntil) {
      loginAttempts.delete(key);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    cleanupStaleEntries();

    // Rate limit check
    const clientKey = getClientKey(req);
    const rateLimit = checkRateLimit(clientKey);
    if (!rateLimit.allowed) {
      const retryMinutes = Math.ceil(rateLimit.retryAfterMs / 60000);
      await logger.warn(`Login rate limited for ${clientKey}`, "AUTH");
      return NextResponse.json(
        { error: `登录尝试过于频繁，请 ${retryMinutes} 分钟后再试` },
        { status: 429 }
      );
    }

    // Ensure at least one admin exists (idempotent)
    await ensureInitialAdmin();

    const { username, password, context } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "请输入用户名和密码" },
        { status: 400 }
      );
    }

    // Find user in database
    const user = await db.user.findUnique({ where: { username } });

    if (!user) {
      recordFailedAttempt(clientKey);
      await logger.warn(
        `Failed login attempt: Unknown user "${username}"`,
        "AUTH"
      );
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      await logger.warn(
        `Failed login attempt: Disabled user "${username}"`,
        "AUTH"
      );
      return NextResponse.json(
        { error: "账号已被禁用，请联系管理员" },
        { status: 403 }
      );
    }

    // Verify password (supports both bcrypt and legacy SHA-256)
    const result = await verifyPassword(password, user.passwordHash);

    if (!result.valid) {
      recordFailedAttempt(clientKey);
      await logger.warn(
        `Failed login attempt: Incorrect password for user "${username}"`,
        "AUTH"
      );
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 后台登录上下文：拒绝非 ADMIN 用户
    if (context === "admin" && user.role !== "ADMIN") {
      recordFailedAttempt(clientKey);
      await logger.warn(
        `Non-admin user "${username}" attempted admin login`,
        "AUTH"
      );
      return NextResponse.json(
        { error: "该账号无后台管理权限，请使用前台登录入口" },
        { status: 403 }
      );
    }

    // If legacy hash was used, upgrade to bcrypt
    if (result.needsUpgrade) {
      const newHash = await hashPassword(password);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
      await logger.info(
        `Password upgraded to bcrypt for user "${username}"`,
        "AUTH"
      );
    }

    // Create DB session
    const token = await createSession(user.id);
    recordSuccess(clientKey);

    // Set token in cookie
    const response = NextResponse.json({
      success: true,
      message: "登录成功",
      user: {
        username: user.username,
        role: user.role,
        displayName: user.displayName || user.username,
      },
    });

    response.headers.append("Set-Cookie", buildCookieHeader(token));

    await logger.info(`User "${username}" (role: ${user.role}) logged in.`, "AUTH");

    await auditLog({
      userId: user.id,
      action: "login",
      resource: "Session",
      detail: { username: user.username, role: user.role, context: context || "user" },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    });

    // P1-17: Clean up expired sessions periodically (fire-and-forget)
    cleanExpiredSessions().catch(() => {});

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    const detail = error instanceof Error ? error.stack : undefined;
    await logger.error(`Login error: ${message}`, "AUTH", detail);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/** GET /api/auth/check — validate current session */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      username: user.username,
      role: user.role,
      displayName: user.username, // Will be enhanced with displayName from DB in future
    });
  } catch (_error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
