import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateAnnotation, autoAnnotateArticle } from "@/services/ai-annotation";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// GET /api/content-items/[id]/annotations — 获取文章的所有批注
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const item = await db.contentItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    const annotations = await db.articleAnnotation.findMany({
      where: { contentItemId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(annotations);
  } catch (error) {
    console.error("Failed to fetch annotations:", error);
    return NextResponse.json({ error: "获取批注失败" }, { status: 500 });
  }
}

// POST /api/content-items/[id]/annotations — 创建批注（手动或 AI 生成）
export async function POST(
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
    const { selectedText, comment, cardType, color, startOffset, endOffset, paragraph, useAI } =
      body;

    const item = await db.contentItem.findUnique({
      where: { id },
      include: { source: { select: { name: true } } },
    });

    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    // AI 自动批注模式
    if (useAI && selectedText) {
      if (!item.fullText) {
        return NextResponse.json(
          { error: "文章没有全文内容，无法生成 AI 批注" },
          { status: 400 }
        );
      }

      const result = await generateAnnotation(
        item.title,
        item.fullText,
        selectedText,
        cardType
      );

      const annotation = await db.articleAnnotation.create({
        data: {
          contentItemId: id,
          selectedText,
          comment: result.comment,
          cardType: cardType ?? null,
          color: color ?? "#facc15",
          startOffset: startOffset ?? null,
          endOffset: endOffset ?? null,
          paragraph: paragraph ?? null,
        },
      });

      return NextResponse.json(annotation, { status: 201 });
    }

    // 手动创建批注
    if (!selectedText || !comment) {
      return NextResponse.json(
        { error: "selectedText 和 comment 为必填项" },
        { status: 400 }
      );
    }

    const annotation = await db.articleAnnotation.create({
      data: {
        contentItemId: id,
        selectedText,
        comment,
        cardType: cardType ?? null,
        color: color ?? "#facc15",
        startOffset: startOffset ?? null,
        endOffset: endOffset ?? null,
        paragraph: paragraph ?? null,
      },
    });

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    console.error("Failed to create annotation:", error);
    return NextResponse.json(
      { error: "创建批注失败，请稍后重试" },
      { status: 500 }
    );
  }
}

// PUT /api/content-items/[id]/annotations — AI 自动批注（全文分析）
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(_request);
  if (!user) {
    const cookieHeader = _request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { id } = await params;

    const item = await db.contentItem.findUnique({
      where: { id },
      include: { source: { select: { name: true } } },
    });

    if (!item) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }

    if (!item.fullText) {
      return NextResponse.json(
        { error: "文章没有全文内容，无法自动批注" },
        { status: 400 }
      );
    }

    const results = await autoAnnotateArticle(id, item.title, item.fullText);

    // 批量创建批注
    const created = await Promise.all(
      results.map((a) =>
        db.articleAnnotation.create({
          data: {
            contentItemId: id,
            selectedText: a.selectedText,
            comment: a.comment,
            paragraph: a.paragraph,
            color: "#facc15",
          },
        })
      )
    );

    return NextResponse.json({
      count: created.length,
      annotations: created,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to auto-annotate:", error);
    return NextResponse.json(
      { error: "自动批注失败，请检查 AI 配置或稍后重试" },
      { status: 500 }
    );
  }
}
