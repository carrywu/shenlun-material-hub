import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  verifyPassword,
  hashPassword,
  createSession,
  buildCookieHeader,
  ensureInitialAdmin,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Ensure at least one admin exists (idempotent)
    await ensureInitialAdmin();

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "请输入用户名和密码" },
        { status: 400 }
      );
    }

    // Find user in database
    const user = await db.user.findUnique({ where: { username } });

    if (!user) {
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
      await logger.warn(
        `Failed login attempt: Incorrect password for user "${username}"`,
        "AUTH"
      );
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
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
      displayName: user.username,
    });
  } catch (_error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
