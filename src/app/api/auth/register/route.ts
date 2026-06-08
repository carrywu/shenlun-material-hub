import { NextRequest, NextResponse } from "next/server";
import { hashPassword, createSession, buildCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit-logger";

function maskInvitationCode(code: string): string {
  return `${code.slice(0, 2)}****`;
}

/** POST /api/auth/register — register with invitation code */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, invitationCode } = body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof invitationCode !== "string"
    ) {
      return NextResponse.json(
        { error: "用户名、密码和邀请码必须为字符串" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.trim();
    const normalizedInvitationCode = invitationCode.trim();
    const maskedInvitationCode = maskInvitationCode(normalizedInvitationCode);

    // Validate required fields
    if (!normalizedUsername || !password || !normalizedInvitationCode) {
      return NextResponse.json(
        { error: "用户名、密码和邀请码不能为空" },
        { status: 400 }
      );
    }

    // Validate username
    if (normalizedUsername.length < 3 || normalizedUsername.length > 32) {
      return NextResponse.json(
        { error: "用户名长度应在 3-32 个字符之间" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_一-龥]+$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: "用户名只能包含字母、数字、下划线和中文" },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度不能少于 6 个字符" },
        { status: 400 }
      );
    }

    // Validate invitation code
    const invitation = await db.invitation.findUnique({
      where: { code: normalizedInvitationCode },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "邀请码无效" },
        { status: 400 }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      await auditLog({
        action: "create",
        resource: "User",
        detail: {
          reason: "invitation_expired",
          invitationId: invitation.id,
          invitationCode: maskedInvitationCode,
          attemptedUsername: normalizedUsername,
        },
      });
      return NextResponse.json(
        { error: "邀请码已过期" },
        { status: 400 }
      );
    }

    // Check if invitation is exhausted
    if (invitation.usedCount >= invitation.maxUses) {
      await auditLog({
        action: "create",
        resource: "User",
        detail: {
          reason: "invitation_exhausted",
          invitationId: invitation.id,
          invitationCode: maskedInvitationCode,
          attemptedUsername: normalizedUsername,
        },
      });
      return NextResponse.json(
        { error: "邀请码已被使用完" },
        { status: 400 }
      );
    }

    // Check for duplicate username
    const existingUser = await db.user.findUnique({ where: { username: normalizedUsername } });
    if (existingUser) {
      return NextResponse.json(
        { error: "用户名已存在" },
        { status: 409 }
      );
    }

    // Extract client IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;

    // Create user and record invitation use in a transaction
    const result = await db.$transaction(async (tx) => {
      // Increment invitation usedCount
      const updatedInvitation = await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedCount: { increment: 1 } },
      });

      // Double-check after increment (race condition safety)
      if (updatedInvitation.usedCount > updatedInvitation.maxUses) {
        throw new Error("INVITATION_EXHAUSTED");
      }

      // Create user
      const passwordHash = await hashPassword(password);
      const newUser = await tx.user.create({
        data: {
          username: normalizedUsername,
          passwordHash,
          role: "USER",
          status: "ACTIVE",
        },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
        },
      });

      // Record invitation use
      await tx.invitationUse.create({
        data: {
          invitationId: invitation.id,
          userId: newUser.id,
        },
      });

      return { user: newUser };
    });

    // Create session
    const token = await createSession(result.user.id);

    // Audit log — P2-5: mask invitation code to avoid plaintext logging
    await auditLog({
      userId: result.user.id,
      action: "create",
      resource: "User",
      resourceId: result.user.id,
      detail: {
        username: result.user.username,
        role: result.user.role,
        invitationId: invitation.id,
        invitationCode: maskedInvitationCode,
      },
      ip,
    });

    // Set session cookie and respond
    const response = NextResponse.json(
      {
        success: true,
        message: "注册成功",
        user: {
          username: result.user.username,
          role: result.user.role,
        },
      },
      { status: 201 }
    );

    response.headers.append("Set-Cookie", buildCookieHeader(token));

    return response;
  } catch (error) {
    // Handle transaction-level invitation exhaustion
    if (error instanceof Error && error.message === "INVITATION_EXHAUSTED") {
      return NextResponse.json(
        { error: "邀请码已被使用完" },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "未知错误";
    console.error("[Register] Error:", message);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
