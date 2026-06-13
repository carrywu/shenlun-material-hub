import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, authErrorResponse } from "@/lib/auth";
import { canModifyResource } from "@/lib/data-isolation";
import { auditLog } from "@/lib/audit-logger";

// GET /api/material-cards/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { id } = await params;
    const card = await db.materialCard.findUnique({
      where: { id },
      include: {
        contentItem: {
          select: {
            id: true,
            title: true,
            originalUrl: true,
            contentType: true,
            platform: true,
            fullText: true,
            source: { select: { id: true, name: true, platform: true } },
          },
        },
        syncRecords: { orderBy: { syncedAt: "desc" }, take: 5 },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    // 访问控制：Owner 可看自己的卡，ADMIN 可看任意卡，
    // null-owner（legacy 公共卡）仅 ADMIN 可见，其他用户返回 404
    if (user.role !== "ADMIN") {
      if (card.ownerUserId !== user.id) {
        // 不泄露资源存在性，统一返回 404
        return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
      }
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error("Failed to fetch material card:", error);
    return NextResponse.json({ error: "获取素材卡失败" }, { status: 500 });
  }
}

// PUT /api/material-cards/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      cardType,
      sourceSnapshot,
      originalFacts,
      aiSummary,
      highlightSuggestions,
      transferSuggestions,
      verificationNotes,
      markdownContent,
      userEditedContent,
      confirmed,
    } = body;

    const existing = await db.materialCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerUserId)) {
      return NextResponse.json({ error: "无权修改该素材卡" }, { status: 403 });
    }

    const updated = await db.materialCard.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(cardType !== undefined && { cardType }),
        ...(sourceSnapshot !== undefined && { sourceSnapshot }),
        ...(originalFacts !== undefined && { originalFacts }),
        ...(aiSummary !== undefined && { aiSummary }),
        ...(highlightSuggestions !== undefined && { highlightSuggestions }),
        ...(transferSuggestions !== undefined && { transferSuggestions }),
        ...(verificationNotes !== undefined && { verificationNotes }),
        ...(markdownContent !== undefined && { markdownContent }),
        ...(userEditedContent !== undefined && { userEditedContent }),
        ...(confirmed !== undefined && {
          confirmed,
          ...(confirmed ? { confirmedAt: new Date() } : {}),
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update material card:", error);
    return NextResponse.json({ error: "更新素材卡失败" }, { status: 500 });
  }
}

// DELETE /api/material-cards/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { id } = await params;

    const existing = await db.materialCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerUserId)) {
      return NextResponse.json({ error: "无权修改该素材卡" }, { status: 403 });
    }

    await db.materialCard.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await auditLog({
      userId: user.id,
      action: "archive",
      resource: "MaterialCard",
      resourceId: id,
      detail: { title: existing.title, ownerUserId: existing.ownerUserId },
    });

    return NextResponse.json({ success: true, message: "素材卡已归档" });
  } catch (error) {
    console.error("Failed to archive material card:", error);
    return NextResponse.json({ error: "归档素材卡失败" }, { status: 500 });
  }
}

// PATCH /api/material-cards/[id] — archive or unarchive
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body as { action: string };

    if (action !== "archive" && action !== "unarchive") {
      return NextResponse.json(
        { error: "无效的 action，支持 archive/unarchive" },
        { status: 400 }
      );
    }

    const existing = await db.materialCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "素材卡不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerUserId)) {
      return NextResponse.json({ error: "无权操作该素材卡" }, { status: 403 });
    }

    const data =
      action === "archive"
        ? { archivedAt: new Date() }
        : { archivedAt: null, confirmed: false };

    const updated = await db.materialCard.update({ where: { id }, data });

    await auditLog({
      userId: user.id,
      action,
      resource: "MaterialCard",
      resourceId: id,
      detail: { title: existing.title, ownerUserId: existing.ownerUserId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to patch material card:", error);
    return NextResponse.json({ error: "操作素材卡失败" }, { status: 500 });
  }
}
