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
import { auditLog } from "@/lib/audit-logger";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
  }
  const role = body.role as string | undefined;
  const status = body.status as string | undefined;
  const displayName = body.displayName as string | undefined;
  const email = body.email as string | undefined;
  const password = body.password as string | undefined;

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

  // 审计日志：区分 disable/enable/role_change/update
  const auditAction =
    status === "DISABLED" ? "user_disable" :
    status === "ACTIVE" && target.status === "DISABLED" ? "user_enable" :
    role && role !== target.role ? "role_change" :
    "update";
  await auditLog({
    userId: admin.id,
    action: auditAction,
    resource: "User",
    resourceId: id,
    detail: { targetUsername: target.username, fields: Object.keys(updates), ...(role ? { newRole: role } : {}), ...(status ? { newStatus: status } : {}) },
    ip: getClientIp(request),
  });

  return NextResponse.json({ user: updated });
}

/** DELETE /api/admin/users/[id] — deletion not supported this phase, use disable instead */
export async function DELETE(request: Request, _context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  return NextResponse.json(
    { error: "当前不支持删除用户，请使用禁用功能" },
    { status: 405 }
  );
}
