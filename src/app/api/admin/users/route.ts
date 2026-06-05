import { NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** GET /api/admin/users — list all users */
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      sessions: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = users.map((u) => ({
    ...u,
    sessionCount: u.sessions.length,
    sessions: undefined,
  }));

  return NextResponse.json({ items: result });
}

/** POST /api/admin/users — create a new user */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const body = await request.json();
  const { username, password, email, displayName, role } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
  }

  if (username.length < 3 || username.length > 32) {
    return NextResponse.json({ error: "用户名长度应在 3-32 个字符之间" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "密码长度不能少于 6 个字符" }, { status: 400 });
  }

  const validRoles = ["ADMIN", "VERIFIED_USER", "USER"];
  const userRole = role || "USER";
  if (!validRoles.includes(userRole)) {
    return NextResponse.json({ error: "无效的用户角色" }, { status: 400 });
  }

  // Check for duplicate username
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.user.create({
    data: {
      username,
      email: email || null,
      displayName: displayName || null,
      passwordHash,
      role: userRole,
      status: "ACTIVE",
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  await logger.info(`Admin "${admin.username}" created user "${username}" (role: ${userRole})`, "AUTH");

  return NextResponse.json({ user: newUser }, { status: 201 });
}
