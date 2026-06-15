import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit-logger";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireAdmin(request);
  if (!user) {
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

  if (body.status !== "DISABLED") {
    return NextResponse.json({ error: "邀请码只能作废，不能恢复" }, { status: 400 });
  }

  const existing = await db.invitation.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, isEnabled: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "邀请码不存在" }, { status: 404 });
  }

  const invitation = await db.invitation.update({
    where: { id },
    data: { status: "DISABLED", isEnabled: false },
    select: {
      id: true,
      code: true,
      status: true,
      isEnabled: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  await auditLog({
    userId: user.id,
    action: "disable",
    resource: "Invitation",
    resourceId: id,
    detail: {
      code: existing.code.slice(0, 2) + "****",
      previousStatus: existing.status,
      previousIsEnabled: existing.isEnabled,
    },
  });

  return NextResponse.json({ invitation });
}
