import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";
import { ownerScopeWhere, mergeWhere } from "@/lib/data-isolation";

const CARD_TYPE_LABELS: Record<string, string> = {
  fact_summary: "案例素材",
  argument_analysis: "论点分析",
  data_highlight: "案例素材",
  policy_compare: "政策对比",
  case_study: "案例研究",
};

// GET /api/export - 导出素材卡为 Markdown
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const { searchParams } = new URL(request.url);
    const cardType = searchParams.get("category") ?? searchParams.get("cardType");
    const confirmed = searchParams.get("confirmed");
    const ids = searchParams.get("ids");

    const where: Record<string, unknown> = {};

    if (ids) {
      where.id = { in: ids.split(",").filter(Boolean) };
    } else {
      if (cardType) where.cardType = cardType;
      if (confirmed !== null && confirmed !== undefined && confirmed !== "all") {
        where.confirmed = confirmed === "true";
      }
    }

    // Multi-user data isolation: restrict to owned material cards
    const ownerFilter = ownerScopeWhere(user, "ownerUserId");
    const mergedWhere = mergeWhere(where, ownerFilter);

    const cards = await db.materialCard.findMany({
      where: mergedWhere,
      orderBy: { createdAt: "desc" },
      include: {
        contentItem: {
          select: {
            title: true,
            source: { select: { name: true } },
            annotations: {
              orderBy: { createdAt: "asc" },
              select: {
                selectedText: true,
                comment: true,
                color: true,
                cardType: true,
              },
            },
          },
        },
      },
    });

    if (cards.length === 0) {
      return NextResponse.json({ error: "没有可导出的素材卡" }, { status: 404 });
    }

    let markdown = "# 申论素材卡导出\n\n";
    markdown += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n`;
    markdown += `> 共 ${cards.length} 张素材卡\n\n---\n\n`;

    for (const card of cards) {
      const typeLabel = CARD_TYPE_LABELS[card.cardType] ?? card.cardType;

      markdown += `## ${card.title}\n\n`;
      markdown += `- **类型**：${typeLabel}\n`;
      if (card.contentItem) {
        const sourceName = card.contentItem.source?.name ?? "";
        if (sourceName) markdown += `- **来源**：${sourceName} - ${card.contentItem.title}\n`;
      }
      markdown += `- **状态**：${card.confirmed ? "已确认" : "未确认"}\n`;
      markdown += `- **创建时间**：${new Date(card.createdAt).toLocaleDateString("zh-CN")}\n\n`;

      if (card.sourceSnapshot) {
        markdown += `### 来源快照\n${card.sourceSnapshot}\n\n`;
      }

      if (card.originalFacts) {
        markdown += `### 原始事实\n${card.originalFacts}\n\n`;
      }

      if (card.aiSummary) {
        markdown += `### AI 摘要\n${card.aiSummary}\n\n`;
      }

      if (card.highlightSuggestions) {
        markdown += `### 亮点建议\n${card.highlightSuggestions}\n\n`;
      }

      if (card.transferSuggestions) {
        markdown += `### 迁移建议\n${card.transferSuggestions}\n\n`;
      }

      if (card.userEditedContent) {
        markdown += `### 用户编辑内容\n${card.userEditedContent}\n\n`;
      }

      if (card.verificationNotes) {
        markdown += `> **验证备注**：${card.verificationNotes}\n\n`;
      }

      const annotations = card.contentItem?.annotations ?? [];
      if (annotations.length > 0) {
        markdown += `### 文章批注\n\n`;
        for (const ann of annotations) {
          markdown += `> **${ann.selectedText}**\n`;
          markdown += `${ann.comment}\n\n`;
        }
      }

      markdown += "---\n\n";
    }

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="shenlun-cards-${new Date().toISOString().slice(0, 10)}.md"`,
      },
    });
  } catch (error) {
    console.error("Export failed:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
