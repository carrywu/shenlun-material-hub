import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessRelevanceWithRetry } from "@/services/ai";

const DEFAULT_CONCURRENCY = 3;

async function assessSingleItem(
  item: {
    id: string;
    title: string;
    contentType: string;
    fullText: string | null;
    excerpt: string | null;
    source: { name: string } | null;
  },
  errors: string[]
): Promise<"accepted" | "rejected" | "skipped" | "error"> {
  const content = item.fullText ?? item.excerpt ?? "";
  if (!content || content.length < 300) {
    errors.push(`[${item.title}] 内容过短，跳过`);
    return "skipped";
  }

  try {
    const result = await assessRelevanceWithRetry(
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
        aiAssessmentError: null, // 清除旧的错误信息
        qualityStatus: result.decision === "accept" ? "accepted" : "filtered",
        processingStatus:
          result.decision === "accept" ? "pending" : "filtered",
        filterReason:
          result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
      },
    });

    return result.decision === "accept" ? "accepted" : "rejected";
  } catch (error) {
    const msg = error instanceof Error ? error.message : "评估失败";
    errors.push(`[${item.title}] ${msg}`);

    await db.contentItem.update({
      where: { id: item.id },
      data: {
        aiAssessmentError: msg,
        aiAssessedAt: new Date(),
      },
    });

    return "error";
  }
}

// POST /api/content-items/assess — 批量 AI 评估内容条目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, retryFailed, concurrency: rawConcurrency } = body;

    const concurrency = Math.min(
      10,
      Math.max(1, rawConcurrency ?? DEFAULT_CONCURRENCY)
    );

    let whereClause: Record<string, unknown>;

    if (retryFailed) {
      // 重试失败的评估
      whereClause = {
        qualityStatus: "candidate",
        aiDecision: null,
        aiAssessmentError: { not: null },
      };
      if (ids && Array.isArray(ids) && ids.length > 0) {
        whereClause.id = { in: ids };
      }
    } else {
      // 正常评估
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { error: "需要提供 ids 数组" },
          { status: 400 }
        );
      }
      whereClause = {
        id: { in: ids },
        qualityStatus: "candidate",
        aiDecision: null,
      };
    }

    const items = await db.contentItem.findMany({
      where: whereClause,
      include: {
        source: { select: { name: true } },
      },
    });

    if (items.length === 0) {
      return NextResponse.json({
        message: retryFailed
          ? "没有需要重试的失败评估"
          : "没有可评估的条目（可能已被评估或质量不达标）",
        assessed: 0,
      });
    }

    let accepted = 0;
    let rejected = 0;
    let errors_count = 0;
    const errors: string[] = [];

    // 并发处理
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((item) => assessSingleItem(item, errors))
      );
      for (const r of results) {
        if (r === "accepted") accepted++;
        else if (r === "rejected") rejected++;
        else if (r === "error") errors_count++;
      }
    }

    return NextResponse.json({
      assessed: items.length,
      accepted,
      rejected,
      errors_count,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("AI 评估失败:", error);
    return NextResponse.json({ error: "评估执行失败" }, { status: 500 });
  }
}
