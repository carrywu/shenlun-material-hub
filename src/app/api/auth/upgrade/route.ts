import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";

// POST /api/auth/upgrade — USER 输邀请码升级 VERIFIED_USER
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  if (user.role !== "USER") {
    return NextResponse.json({ error: "当前角色无需升级" }, { status: 400 });
  }
  try {
    const { invitationCode } = (await request.json()) as { invitationCode: string };
    if (!invitationCode) {
      return NextResponse.json({ error: "请填写邀请码" }, { status: 400 });
    }

    const invitation = await db.invitation.findUnique({
      where: { code: invitationCode },
    });
    if (!invitation) {
      return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
    }
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
    }
    if (invitation.usedCount >= invitation.maxUses) {
      return NextResponse.json({ error: "邀请码已被使用完" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const updated = await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedCount: { increment: 1 } },
      });
      if (updated.usedCount > updated.maxUses) {
        throw new Error("INVITATION_EXHAUSTED");
      }
      await tx.user.update({
        where: { id: user.id },
        data: { role: "VERIFIED_USER" },
      });
      await tx.invitationUse.create({
        data: { invitationId: invitation.id, userId: user.id },
      });
    });

    await auditLog({
      userId: user.id,
      action: "upgrade",
      resource: "User",
      resourceId: user.id,
      detail: {
        from: "USER",
        to: "VERIFIED_USER",
        invitationId: invitation.id,
        invitationCode: invitationCode.slice(0, 2) + "****",
      },
    });

    return NextResponse.json({
      success: true,
      message: "升级成功",
      role: "VERIFIED_USER",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVITATION_EXHAUSTED") {
      return NextResponse.json({ error: "邀请码已被使用完" }, { status: 400 });
    }
    console.error("upgrade failed:", error);
    return NextResponse.json({ error: "升级失败" }, { status: 500 });
  }
}
