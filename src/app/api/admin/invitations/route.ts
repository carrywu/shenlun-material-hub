import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit-logger";

/** Generate a random alphanumeric code of the given length */
function generateInvitationCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/** GET /api/admin/invitations — list all invitations with usage info */
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }

  const invitations = await db.invitation.findMany({
    include: {
      creator: { select: { id: true, username: true, displayName: true } },
      uses: {
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
        orderBy: { usedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = invitations.map((inv) => ({
    id: inv.id,
    code: inv.code,
    createdBy: inv.createdBy,
    creator: inv.creator,
    maxUses: inv.maxUses,
    usedCount: inv.usedCount,
    remainingUses: inv.maxUses - inv.usedCount,
    expiresAt: inv.expiresAt,
    isExpired: inv.expiresAt ? new Date() > inv.expiresAt : false,
    isExhausted: inv.usedCount >= inv.maxUses,
    createdAt: inv.createdAt,
    uses: inv.uses.map((u) => ({
      id: u.id,
      userId: u.userId,
      user: u.user,
      usedAt: u.usedAt,
    })),
  }));

  return NextResponse.json({ items: result });
}

/** POST /api/admin/invitations — create a new invitation code */
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }

  const body = await request.json();
  const { maxUses, expiresAt } = body;

  // Validate maxUses
  const uses = typeof maxUses === "number" ? Math.max(1, Math.floor(maxUses)) : 1;
  if (uses > 1000) {
    return NextResponse.json(
      { error: "最大使用次数不能超过 1000" },
      { status: 400 }
    );
  }

  // Validate expiresAt
  let expiry: Date | null = null;
  if (expiresAt) {
    expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) {
      return NextResponse.json(
        { error: "无效的过期时间" },
        { status: 400 }
      );
    }
    if (expiry <= new Date()) {
      return NextResponse.json(
        { error: "过期时间不能早于当前时间" },
        { status: 400 }
      );
    }
  }

  // Generate a unique code (retry on collision)
  let code: string;
  let attempts = 0;
  do {
    code = generateInvitationCode(8);
    const existing = await db.invitation.findUnique({ where: { code } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    return NextResponse.json(
      { error: "生成邀请码失败，请重试" },
      { status: 500 }
    );
  }

  const invitation = await db.invitation.create({
    data: {
      code,
      createdBy: user.id,
      maxUses: uses,
      expiresAt: expiry,
    },
    include: {
      creator: { select: { id: true, username: true, displayName: true } },
    },
  });

  await auditLog({
    userId: user.id,
    action: "create",
    resource: "Invitation",
    resourceId: invitation.id,
    detail: { code, maxUses: uses, expiresAt: expiry?.toISOString() ?? null },
  });

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        code: invitation.code,
        createdBy: invitation.createdBy,
        creator: invitation.creator,
        maxUses: invitation.maxUses,
        usedCount: invitation.usedCount,
        remainingUses: invitation.maxUses - invitation.usedCount,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    },
    { status: 201 }
  );
}
