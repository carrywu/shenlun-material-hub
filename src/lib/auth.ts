// Auth utilities: bcrypt passwords, DB sessions, JWT (legacy compat), role-based middleware

import bcrypt from "bcryptjs";
import { db } from "./db";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "VERIFIED_USER" | "USER";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}

// ─── Password utilities ──────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

/** Hash a password with bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt hashes (starting with $2a$/$2b$) and legacy SHA-256 hashes.
 * If a legacy SHA-256 hash is verified, returns { valid: true, needsUpgrade: true, plainPassword }.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsUpgrade?: boolean }> {
  // bcrypt hash format: $2a$... or $2b$...
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid };
  }

  // Legacy SHA-256 fallback (old auth system)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  const inputHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison — P3-9: don't early-return on length mismatch
  const maxLen = Math.max(inputHash.length, storedHash.length);
  let result = inputHash.length ^ storedHash.length; // length diff encoded in result
  for (let i = 0; i < maxLen; i++) {
    result |= (inputHash.charCodeAt(i) || 0) ^ (storedHash.charCodeAt(i) || 0);
  }
  if (result === 0) {
    return { valid: true, needsUpgrade: true };
  }
  return { valid: false };
}

// ─── Session utilities ────────────────────────────────────────────────────────

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Generate a cryptographically secure random token */
function generateSessionToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create a new DB session for a user. Returns the plain token. */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  await db.session.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

/** Validate a session token. Returns the user or null. */
export async function validateSession(token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (new Date() > session.expiresAt) {
    // Expired — clean up
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role as UserRole,
    status: session.user.status as UserStatus,
  };
}

/** Delete a session by token */
export async function revokeSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } }).catch(() => {});
}

/** Revoke all sessions for a user */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await db.session.deleteMany({ where: { userId } });
  return result.count;
}

/** Clean up expired sessions (call periodically) */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export const AUTH_COOKIE_NAME = "auth_token";

// Secure cookie 判定：生产（HTTPS）启用，staging 走 HTTP 必须关闭，
// 否则浏览器在 HTTP 下会丢弃 auth_token，导致登录后仍进不去后台。
function shouldUseSecureCookie(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.APP_ENV === "staging") return false;
  return true;
}

export function buildCookieHeader(token: string, maxAge = 86400): string {
  const secure = shouldUseSecureCookie();
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; ${secure ? "Secure;" : ""} SameSite=Strict; Max-Age=${maxAge}`;
}

export function buildClearCookieHeader(): string {
  const secure = shouldUseSecureCookie();
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; ${secure ? "Secure;" : ""} SameSite=Strict; Max-Age=0`;
}

// ─── Legacy JWT support (for migration period) ──────────────────────────────

function getLegacyJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // In production, JWT_SECRET is mandatory. In dev/test, use a fallback.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[AUTH] JWT_SECRET environment variable is required in production. " +
          "Set it to a cryptographically random string (e.g., openssl rand -hex 32)."
      );
    }
    // Dev/test fallback — never use in production
    return "dev-only-jwt-secret-do-not-use-in-production";
  }
  return secret;
}

const encoder = new TextEncoder();

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/** Verify a legacy JWT token and extract the username */
async function verifyLegacyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const key = await getCryptoKey(getLegacyJwtSecret());

    let base64 = encodedSignature.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const sigBinary = atob(base64);
    const sigBuffer = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBuffer[i] = sigBinary.charCodeAt(i);

    const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, encoder.encode(dataToVerify));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;

    return typeof payload.username === "string" ? payload.username : null;
  } catch {
    return null;
  }
}

// ─── Auth middleware for API routes ──────────────────────────────────────────

export interface AuthenticatedRequest {
  user: AuthUser;
}

/**
 * Extract and validate the user from the request.
 * Supports both new DB sessions and legacy JWT tokens.
 * Returns null if unauthenticated.
 */
export async function getUserFromRequest(
  request: Request
): Promise<AuthUser | null> {
  // 1. Try DB session token from cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (tokenMatch) {
    const token = tokenMatch[1];
    const user = await validateSession(token);
    if (user) return user;
  }

  // 2. Try legacy JWT token from cookie (migration support)
  if (tokenMatch) {
    const token = tokenMatch[1];
    const legacyUsername = await verifyLegacyJWT(token);
    if (legacyUsername) {
      // Find or create user from legacy JWT
      const user = await db.user.findFirst({
        where: {
          username: legacyUsername,
          status: "ACTIVE",
        },
      });
      if (user) {
        return {
          id: user.id,
          username: user.username,
          role: user.role as UserRole,
          status: user.status as UserStatus,
        };
      }
    }
  }

  return null;
}

/**
 * Require authentication. Returns user or null.
 * Usage: const user = await requireAuth(request); if (!user) return unauthorized();
 */
export async function requireAuth(request: Request): Promise<AuthUser | null> {
  return getUserFromRequest(request);
}

/**
 * Require ADMIN role. Returns user or null.
 */
export async function requireAdmin(request: Request): Promise<AuthUser | null> {
  const user = await getUserFromRequest(request);
  if (!user) return null;
  if (user.role !== "ADMIN") return null;
  return user;
}

/**
 * Require at least VERIFIED_USER role. Returns user or null.
 */
export async function requireVerifiedUser(
  request: Request
): Promise<AuthUser | null> {
  const user = await getUserFromRequest(request);
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "VERIFIED_USER") return null;
  return user;
}

// ─── Unauthorized response helpers ──────────────────────────────────────────

export function unauthorizedResponse(message = "未登录或会话已过期") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "权限不足") {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * P2-6: Return 401 (no cookie) or 403 (has cookie but insufficient role).
 * Usage: `const user = await requireAuth(request); if (!user) return authErrorResponse(request);`
 */
export function authErrorResponse(request: Request): Response {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader.includes("auth_token")) return unauthorizedResponse();
  return forbiddenResponse();
}

// ─── User management utilities ──────────────────────────────────────────────

/** Ensure at least one admin exists. Idempotent — safe to call multiple times. */
export async function ensureInitialAdmin(): Promise<void> {
  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const existingUser = await db.user.findUnique({ where: { username } });

  if (existingUser) {
    // Ensure this user is admin
    if (existingUser.role !== "ADMIN") {
      await db.user.update({
        where: { id: existingUser.id },
        data: { role: "ADMIN", status: "ACTIVE" },
      });
    }
    return;
  }

  // Create admin from env vars
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  let passwordHash: string;

  if (envHash && (envHash.startsWith("$2a$") || envHash.startsWith("$2b$"))) {
    // Already a bcrypt hash
    passwordHash = envHash;
  } else if (process.env.NODE_ENV === "production") {
    // Production: refuse to create admin with default password
    throw new Error(
      "[AUTH] Production environment requires ADMIN_PASSWORD_HASH (bcrypt) to be set. " +
        "Generate one with: node -e \"const bcrypt=require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD',12).then(h=>console.log(h))\""
    );
  } else if (envHash) {
    // Non-production: Legacy SHA-256 hash — create with default password that must be changed
    passwordHash = await hashPassword("admin123");
    await logger.warn(
      `Admin password initialized with default (env hash was SHA-256 legacy). Please change immediately.`,
      "AUTH"
    );
  } else {
    // Non-production: No env var at all — use default password
    passwordHash = await hashPassword("admin123");
    await logger.warn(
      "Admin password initialized with default (admin123). Please change immediately.",
      "AUTH"
    );
  }

  await db.user.create({
    data: {
      username,
      displayName: "管理员",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  await logger.info(`Initial admin user "${username}" created.`, "AUTH");
}

/** Count active admins — used to prevent disabling the last admin */
export async function countActiveAdmins(): Promise<number> {
  return db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
}
