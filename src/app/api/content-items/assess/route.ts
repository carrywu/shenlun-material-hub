import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessRelevance } from "@/services/ai";

// POST /api/content-items/assess — 批量 AI 评估内容条目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "需要提供 ids 数组" },
        { status: 400 }
      );
    }

    // 查询候选条目（只评估 qualityStatus=candidate 且未评估过的）
    const items = await db.contentItem.findMany({
      where: {
        id: { in: ids },
        qualityStatus: "candidate",
        aiDecision: null,
      },
      include: {
        source: { select: { name: true } },
      },
    });

    if (items.length === 0) {
      return NextResponse.json({
        message: "没有可评估的条目（可能已被评估或质量不达标）",
        assessed: 0,
      });
    }

    let accepted = 0;
    let rejected = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const content = item.fullText ?? item.excerpt ?? "";
        if (!content || content.length < 300) {
          errors.push(`[${item.title}] 内容过短，跳过`);
          continue;
        }

        const result = await assessRelevance(
          item.title,
          item.source?.name ?? "未知来源",
          content,
          item.contentType
        );

        await db.contentItem.update({
          where: { id: item.id },
          data: {
            aiDecision: result.decision,
            aiReason: result.reason,
            contentGenre: result.contentGenre,
            aiCategories: JSON.stringify(result.categories),
            aiUsableFor: JSON.stringify(result.usableFor),
            aiSummary: result.summary || null,
            aiQuotes: JSON.stringify(result.quotes),
            aiAssessedAt: new Date(),
            qualityStatus: result.decision === "accept" ? "accepted" : "filtered",
            processingStatus: result.decision === "accept" ? "pending" : "filtered",
            filterReason: result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
          },
        });

        if (result.decision === "accept") {
          accepted++;
        } else {
          rejected++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "评估失败";
        errors.push(`[${item.title}] ${msg}`);

        // 记录评估错误
        await db.contentItem.update({
          where: { id: item.id },
          data: {
            aiAssessmentError: msg,
            aiAssessedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      assessed: items.length,
      accepted,
      rejected,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("AI 评估失败:", error);
    return NextResponse.json({ error: "评估执行失败" }, { status: 500 });
  }
}
