import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { ownedResourceWhere, mergeWhere, canAccessResource } from "@/lib/data-isolation";

// GET /api/material-cards — 分页 + 筛选
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const contentItemId = searchParams.get("contentItemId");
    const cardType = searchParams.get("cardType");
    const confirmed = searchParams.get("confirmed");
    const search = searchParams.get("search");
    const archivedOnly = searchParams.get("archivedOnly");

    const where: Record<string, unknown> = {};
    if (archivedOnly === "true") {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    if (contentItemId) where.contentItemId = contentItemId;
    if (cardType) where.cardType = cardType;
    if (confirmed !== null && confirmed !== undefined && confirmed !== "all") {
      where.confirmed = confirmed === "true";
    }

    // P1-001: Multi-user data isolation — only own cards (legacy null-owner is admin-only)
    const ownerFilter = ownedResourceWhere(user);

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { aiSummary: { contains: search } },
      ];
    }

    // Merge owner filter into where clause
    const mergedWhere = mergeWhere(where, ownerFilter);

    const [data, total] = await Promise.all([
      db.materialCard.findMany({
        where: mergedWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contentItem: {
            select: {
              id: true,
              title: true,
              source: { select: { name: true } },
            },
          },
        },
      }),
      db.materialCard.count({ where: mergedWhere }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch material cards:", error);
    return NextResponse.json(
      { error: "获取素材卡列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/material-cards — 手动创建素材卡
// P0-5: 仅 VERIFIED_USER / ADMIN 可建卡（与 AI 生成一致），USER 不可（需求 2.1/4）
export async function POST(request: NextRequest) {
  const user = await requireVerifiedUser(request);
  if (!user) return unauthorizedResponse();
  // 防御层：即使 requireVerifiedUser 被绕过，USER 仍显式拒绝
  if (user.role === "USER") return forbiddenResponse("普通用户不能创建素材卡，请升级为认证用户");
  try {
    const body = await request.json();
    const {
      contentItemId,
      cardType,
      title,
      sourceSnapshot,
      originalFacts,
      aiSummary,
      highlightSuggestions,
      transferSuggestions,
    } = body;

    if (!contentItemId || !cardType || !title) {
      return NextResponse.json(
        { error: "contentItemId, cardType, title 为必填项" },
        { status: 400 }
      );
    }

    // Verify content item exists and user can access it
    const item = await db.contentItem.findUnique({
      where: { id: contentItemId },
    });
    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    // Check content item access — user must be able to read it to create a card from it
    if (!canAccessResource(user, item.ownerUserId, item.visibility)) {
      return forbiddenResponse("无法基于不可访问的内容创建素材卡");
    }

    const card = await db.materialCard.create({
      data: {
        contentItemId,
        cardType,
        title,
        ownerUserId: user.id,
        sourceSnapshot: sourceSnapshot ?? null,
        originalFacts: originalFacts ?? null,
        aiSummary: aiSummary ?? null,
        highlightSuggestions: highlightSuggestions ?? null,
        transferSuggestions: transferSuggestions ?? null,
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Failed to create material card:", error);
    return NextResponse.json(
      { error: "创建素材卡失败" },
      { status: 500 }
    );
  }
}
