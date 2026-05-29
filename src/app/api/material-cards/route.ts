import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateBatchMaterialCards } from "@/services/ai";

// GET /api/material-cards - 获取素材卡列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const contentItemId = searchParams.get("articleId") ?? searchParams.get("contentItemId");
    const cardType = searchParams.get("category") ?? searchParams.get("cardType");
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

// POST /api/material-cards - 批量生成素材卡
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleIds, contentItemIds } = body as {
      articleIds?: string[];
      contentItemIds?: string[];
    };

    const itemIds = contentItemIds ?? articleIds;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "请提供至少一个内容条目 ID" },
        { status: 400 }
      );
    }

    if (itemIds.length > 20) {
      return NextResponse.json(
        { error: "单次最多批量生成 20 个内容条目的素材卡" },
        { status: 400 }
      );
    }

    // Fetch content items
    const items = await db.contentItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        title: true,
        fullText: true,
        contentType: true,
        source: { select: { name: true } },
      },
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "未找到指定内容条目" },
        { status: 404 }
      );
    }

    // Generate material cards
    const results = await generateBatchMaterialCards(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source?.name ?? "未知来源",
        content: item.fullText ?? "",
        category: item.contentType,
      }))
    );

    // Save successful results to database
    const savedCards = [];
    const errors = [];

    for (const result of results) {
      if (result.success && result.data) {
        try {
          const card = await db.materialCard.create({
            data: {
              contentItemId: result.contentItemId,
              cardType: "fact_summary",
              title: result.data.structured.mainPoint.slice(0, 100),
              aiSummary: result.data.rawJson,
              markdownContent: result.data.rawJson,
              sourceSnapshot: result.data.structured.applicableTypes.join(","),
              originalFacts: result.data.structured.structure.background.slice(0, 200),
            },
          });
          savedCards.push(card);
        } catch (dbError) {
          errors.push({
            contentItemId: result.contentItemId,
            error: `保存失败: ${dbError instanceof Error ? dbError.message : "未知错误"}`,
          });
        }
      } else {
        errors.push({
          contentItemId: result.contentItemId,
          error: result.error ?? "生成失败",
        });
      }
    }

    return NextResponse.json({
      success: savedCards.length,
      failed: errors.length,
      cards: savedCards,
      errors,
    });
  } catch (error) {
    console.error("Failed to generate material cards:", error);
    return NextResponse.json(
      { error: "生成素材卡失败，请检查 OPENAI_API_KEY 配置" },
      { status: 500 }
    );
  }
}
