import { NextResponse } from "next/server";
import {
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
  hashPassword,
  revokeAllUserSessions,
  countActiveAdmins,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/users/[id] — get a single user */
export async function GET(request: Request, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const { id } = await context.params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      sessions: { select: { id: true, createdAt: true, expiresAt: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

/** PUT /api/admin/users/[id] — update a user */
export async function PUT(request: Request, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const { id } = await context.params;
  const body = await request.json();
  const { role, status, displayName, email, password } = body;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Safety: cannot disable or demote the last active admin
  if (target.role === "ADMIN") {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      if (status === "DISABLED") {
        return NextResponse.json(
          { error: "不能禁用最后一个管理员" },
          { status: 400 }
        );
      }
      if (role && role !== "ADMIN") {
        return NextResponse.json(
          { error: "不能降级最后一个管理员" },
          { status: 400 }
        );
      }
    }
  }

  const updates: Record<string, unknown> = {};
  if (role && ["ADMIN", "VERIFIED_USER", "USER"].includes(role)) {
    updates.role = role;
  }
  if (status && ["ACTIVE", "DISABLED"].includes(status)) {
    updates.status = status;
  }
  if (displayName !== undefined) updates.displayName = displayName;
  if (email !== undefined) updates.email = email || null;

  // Password reset
  if (password) {
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度不能少于 6 个字符" },
        { status: 400 }
      );
    }
    updates.passwordHash = await hashPassword(password);
    // Revoke all sessions on password reset
    await revokeAllUserSessions(id);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await logger.info(
    `Admin "${admin.username}" updated user "${target.username}": ${JSON.stringify(Object.keys(updates))}`,
    "AUTH"
  );

  return NextResponse.json({ user: updated });
}

/** DELETE /api/admin/users/[id] — delete a user */
export async function DELETE(request: Request, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const { id } = await context.params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Cannot delete the last admin
  if (target.role === "ADMIN") {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "不能删除最后一个管理员" },
        { status: 400 }
      );
    }
  }

  // Cannot delete yourself
  if (target.id === admin.id) {
    return NextResponse.json(
      { error: "不能删除自己的账号" },
      { status: 400 }
    );
  }

  await db.user.delete({ where: { id } });

  await logger.info(
    `Admin "${admin.username}" deleted user "${target.username}"`,
    "AUTH"
  );

  return NextResponse.json({ success: true });
}
