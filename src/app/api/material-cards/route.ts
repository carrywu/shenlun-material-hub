import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/material-cards — 分页 + 筛选
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const contentItemId = searchParams.get("contentItemId");
    const cardType = searchParams.get("cardType");
    const confirmed = searchParams.get("confirmed");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (contentItemId) where.contentItemId = contentItemId;
    if (cardType) where.cardType = cardType;
    if (confirmed !== null && confirmed !== undefined && confirmed !== "all") {
      where.confirmed = confirmed === "true";
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { aiSummary: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.materialCard.findMany({
        where,
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
      db.materialCard.count({ where }),
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
export async function POST(request: NextRequest) {
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

    // Verify content item exists
    const item = await db.contentItem.findUnique({
      where: { id: contentItemId },
    });
    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    const card = await db.materialCard.create({
      data: {
        contentItemId,
        cardType,
        title,
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
