import { NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit-logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
  }

  const target = await db.invitation.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "邀请码不存在" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const { maxUses, expiresAt, isEnabled, note } = body as Record<string, unknown>;

  if (maxUses !== undefined) {
    if (typeof maxUses !== "number" || !Number.isFinite(maxUses)) {
      return NextResponse.json({ error: "使用次数必须为数字" }, { status: 400 });
    }
    const uses = Math.floor(maxUses);
    if (uses < target.usedCount) {
      return NextResponse.json({ error: "最大使用次数不能小于已使用次数" }, { status: 400 });
    }
    if (uses < 1 || uses > 1000) {
      return NextResponse.json({ error: "最大使用次数应在 1-1000 之间" }, { status: 400 });
    }
    updates.maxUses = uses;
  }

  if (expiresAt !== undefined) {
    if (expiresAt === null || expiresAt === "") {
      updates.expiresAt = null;
    } else if (typeof expiresAt === "string") {
      const expiry = new Date(expiresAt);
      if (isNaN(expiry.getTime())) {
        return NextResponse.json({ error: "无效的过期时间" }, { status: 400 });
      }
      updates.expiresAt = expiry;
    } else {
      return NextResponse.json({ error: "过期时间格式无效" }, { status: 400 });
    }
  }

  if (isEnabled !== undefined) {
    if (typeof isEnabled !== "boolean") {
      return NextResponse.json({ error: "启用状态必须为布尔值" }, { status: 400 });
    }
    updates.isEnabled = isEnabled;
  }

  if (note !== undefined) {
    if (note !== null && typeof note !== "string") {
      return NextResponse.json({ error: "备注必须为字符串" }, { status: 400 });
    }
    updates.note = typeof note === "string" && note.trim() ? note.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const invitation = await db.invitation.update({
    where: { id },
    data: updates,
    include: {
      creator: { select: { id: true, username: true, displayName: true } },
      uses: {
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
        orderBy: { usedAt: "desc" },
      },
    },
  });

  await auditLog({
    userId: admin.id,
    action: "update",
    resource: "Invitation",
    resourceId: id,
    detail: { updatedFields: Object.keys(updates) },
  });

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      code: invitation.code,
      creator: invitation.creator,
      maxUses: invitation.maxUses,
      usedCount: invitation.usedCount,
      remainingUses: invitation.maxUses - invitation.usedCount,
      isEnabled: invitation.isEnabled,
      note: invitation.note,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      uses: invitation.uses.map((u) => ({
        id: u.id,
        userId: u.userId,
        user: u.user,
        usedAt: u.usedAt,
      })),
    },
  });
}
