import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateBatchMaterialCards } from "@/services/ai";

// GET /api/material-cards - 获取素材卡列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const articleId = searchParams.get("articleId");
    const category = searchParams.get("category");
    const confirmed = searchParams.get("confirmed");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (articleId) where.articleId = articleId;
    if (category) where.category = category;
    if (confirmed !== null && confirmed !== undefined && confirmed !== "all") {
      where.confirmed = confirmed === "true";
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.materialCard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          article: { select: { id: true, title: true, source: true } },
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
    const { articleIds } = body as { articleIds: string[] };

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json(
        { error: "请提供至少一个文章 ID" },
        { status: 400 }
      );
    }

    if (articleIds.length > 20) {
      return NextResponse.json(
        { error: "单次最多批量生成 20 篇文章的素材卡" },
        { status: 400 }
      );
    }

    // Fetch articles
    const articles = await db.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true, source: true, content: true, category: true },
    });

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "未找到指定文章" },
        { status: 404 }
      );
    }

    // Generate material cards
    const results = await generateBatchMaterialCards(articles);

    // Save successful results to database
    const savedCards = [];
    const errors = [];

    for (const result of results) {
      if (result.success && result.data) {
        try {
          const card = await db.materialCard.create({
            data: {
              articleId: result.articleId,
              title: result.data.structured.mainPoint.slice(0, 100),
              content: result.data.rawJson,
              category: articles.find((a) => a.id === result.articleId)?.category ?? "其他",
              tags: result.data.structured.applicableTypes.join(","),
              excerpt: result.data.structured.structure.background.slice(0, 200),
              generationPrompt: "default",
            },
          });
          savedCards.push(card);
        } catch (dbError) {
          errors.push({
            articleId: result.articleId,
            error: `保存失败: ${dbError instanceof Error ? dbError.message : "未知错误"}`,
          });
        }
      } else {
        errors.push({
          articleId: result.articleId,
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
