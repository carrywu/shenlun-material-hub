import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin, unauthorizedResponse, forbiddenResponse, authErrorResponse } from "@/lib/auth";
import { canAccessResource, canModifyResource } from "@/lib/data-isolation";

// GET /api/content-items/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { id } = await params;
    // P0-001: 非 ADMIN 只能看自己的子资源；ADMIN 看全部
    const isAdmin = user.role === "ADMIN";
    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, platform: true } },
        materialCards: isAdmin
          ? { orderBy: { createdAt: "desc" } }
          : {
              where: { ownerUserId: user.id },
              orderBy: { createdAt: "desc" },
            },
        annotations: isAdmin
          ? { orderBy: { createdAt: "desc" } }
          : {
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
            },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    if (!canAccessResource(user, item.ownerUserId, item.visibility)) {
      return NextResponse.json({ error: "无权访问该内容" }, { status: 403 });
    }

    // P3: 非 ADMIN 只能访问 approved 文章（防 ID 绕过）
    if (user.role !== "ADMIN" && item.adminReviewStatus !== "approved") {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    // P0-001: 防御性二次过滤（DB include where 在生产过滤；此处兜底，
    // 确保非 ADMIN 绝不泄漏他人/legacy null 卡与批注）
    const safeItem = isAdmin
      ? item
      : {
          ...item,
          materialCards: (item.materialCards ?? []).filter(
            (c) => c.ownerUserId === user.id
          ),
          annotations: (item.annotations ?? []).filter(
            (a) => a.userId === user.id
          ),
        };

    // Fetch per-user learning state
    const userState = await db.userContentState.findUnique({
      where: { userId_contentItemId: { userId: user.id, contentItemId: id } },
    });
    const userFavorite = await db.articleFavorite.findUnique({
      where: { userId_contentItemId: { userId: user.id, contentItemId: id } },
    });

    return NextResponse.json({
      ...safeItem,
      userRead: userState?.read ?? false,
      userIgnored: userState?.ignored ?? false,
      userBookmarked: !!userFavorite,
    });
  } catch (error) {
    console.error("Failed to fetch content item:", error);
    return NextResponse.json({ error: "获取内容条目失败" }, { status: 500 });
  }
}

// PUT /api/content-items/[id] — 更新处理状态等
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const { processingStatus, fullText, excerpt, topicTags, regionScopes, bookmarked, read, ignored } = body;

    const existing = await db.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerUserId)) {
      return NextResponse.json({ error: "无权修改该内容" }, { status: 403 });
    }

    const updated = await db.contentItem.update({
      where: { id },
      data: {
        ...(processingStatus !== undefined && { processingStatus }),
        ...(fullText !== undefined && {
          fullText,
          fullTextStored: !!fullText,
          // P2-16: recalculate derived fields when fullText changes
          effectiveTextLength: fullText ? fullText.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim().length : 0,
          contentHash: fullText ? createHash("sha256").update(fullText).digest("hex").slice(0, 16) : null,
        }),
        ...(excerpt !== undefined && { excerpt }),
        ...(topicTags !== undefined && { topicTags: JSON.stringify(topicTags) }),
        ...(regionScopes !== undefined && { regionScopes: JSON.stringify(regionScopes) }),
        ...(bookmarked !== undefined && { bookmarked }),
        ...(read !== undefined && { read }),
        ...(ignored !== undefined && { ignored }),
      },
      include: {
        source: { select: { id: true, name: true, platform: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update content item:", error);
    return NextResponse.json({ error: "更新内容条目失败" }, { status: 500 });
  }
}

// DELETE /api/content-items/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { id } = await params;

    const existing = await db.contentItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerUserId)) {
      return NextResponse.json({ error: "无权修改该内容" }, { status: 403 });
    }

    await db.contentItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete content item:", error);
    return NextResponse.json({ error: "删除内容条目失败" }, { status: 500 });
  }
}
