import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";

function maskInvitationCode(code: string): string {
  return `${code.slice(0, 2)}****`;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  if (user.role === "ADMIN" || user.role === "VERIFIED_USER") {
    return NextResponse.json({
      success: true,
      message: "当前账号已是认证用户",
      user,
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
  }

  const invitationCode = (body as { invitationCode?: unknown }).invitationCode;
  if (typeof invitationCode !== "string") {
    return NextResponse.json({ error: "邀请码必须为字符串" }, { status: 400 });
  }

  const normalizedCode = invitationCode.trim();
  if (!normalizedCode) {
    return NextResponse.json({ error: "邀请码不能为空" }, { status: 400 });
  }

  const invitation = await db.invitation.findUnique({ where: { code: normalizedCode } });
  if (!invitation) {
    return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
  }
  if ("isEnabled" in invitation && invitation.isEnabled === false) {
    return NextResponse.json({ error: "邀请码已被禁用" }, { status: 400 });
  }
  if (invitation.expiresAt && new Date() > invitation.expiresAt) {
    return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
  }
  if (invitation.usedCount >= invitation.maxUses) {
    return NextResponse.json({ error: "邀请码已被使用完" }, { status: 400 });
  }

  const existingUse = await db.invitationUse.findFirst({
    where: { invitationId: invitation.id, userId: user.id },
  });
  if (existingUse) {
    return NextResponse.json({ error: "你已使用过该邀请码" }, { status: 400 });
  }

  try {
    const updatedUser = await db.$transaction(async (tx) => {
      const updatedInvitation = await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedCount: { increment: 1 } },
      });
      if (updatedInvitation.usedCount > updatedInvitation.maxUses) {
        throw new Error("INVITATION_EXHAUSTED");
      }

      await tx.invitationUse.create({
        data: { invitationId: invitation.id, userId: user.id },
      });

      return tx.user.update({
        where: { id: user.id },
        data: { role: "VERIFIED_USER" },
        select: { id: true, username: true, displayName: true, role: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: "认证成功",
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVITATION_EXHAUSTED") {
      return NextResponse.json({ error: "邀请码已被使用完" }, { status: 400 });
    }
    console.error("[AccountUpgrade] Error:", {
      message: error instanceof Error ? error.message : String(error),
      invitationCode: maskInvitationCode(normalizedCode),
      userId: user.id,
    });
    return NextResponse.json({ error: "升级失败，请稍后重试" }, { status: 500 });
  }
}
