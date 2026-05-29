import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { MaterialCardStructuredContent } from "@/types";

// GET /api/export - 导出素材卡为 Markdown
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardType = searchParams.get("category");
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

    const cards = await db.materialCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contentItem: { select: { title: true, source: { select: { name: true } } } },
      },
    });

    if (cards.length === 0) {
      return NextResponse.json({ error: "没有可导出的素材卡" }, { status: 404 });
    }

    let markdown = "# 申论素材卡导出\n\n";
    markdown += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n`;
    markdown += `> 共 ${cards.length} 张素材卡\n\n---\n\n`;

    for (const card of cards) {
      const displayContent = card.userEditedContent ?? card.markdownContent ?? card.aiSummary ?? "";
      let structured: MaterialCardStructuredContent | null = null;
      try {
        structured = JSON.parse(displayContent);
      } catch {
        // fallback to raw content
      }

      markdown += `## ${card.title}\n\n`;
      markdown += `- **类型**：${card.cardType}\n`;
      if (card.contentItem) {
        const sourceName = card.contentItem.source?.name ?? "";
        if (sourceName) markdown += `- **来源**：${sourceName} - ${card.contentItem.title}\n`;
      }
      markdown += `- **状态**：${card.confirmed ? "已确认" : "未确认"}\n`;
      markdown += `- **创建时间**：${new Date(card.createdAt).toLocaleDateString("zh-CN")}\n\n`;

      if (structured) {
        markdown += `### 主旨\n${structured.mainPoint}\n\n`;

        markdown += `### 结构拆解\n`;
        markdown += `- **背景**：${structured.structure.background}\n`;
        markdown += `- **问题**：${structured.structure.problem}\n`;
        markdown += `- **原因**：${structured.structure.cause}\n`;
        markdown += `- **对策**：${structured.structure.solution}\n`;
        markdown += `- **升华**：${structured.structure.sublimation}\n\n`;

        if (structured.standardExpressions.length > 0) {
          markdown += `### 规范表达\n`;
          for (const expr of structured.standardExpressions) {
            markdown += `- ${expr}\n`;
          }
          markdown += "\n";
        }

        if (structured.cases.length > 0) {
          markdown += `### 可用案例\n`;
          for (const c of structured.cases) {
            markdown += `- ${c}\n`;
          }
          markdown += "\n";
        }

        markdown += `### 省情关联\n`;
        markdown += `- **广东**：${structured.provinceRelevance.guangdong}\n`;
        markdown += `- **湖南**：${structured.provinceRelevance.hunan}\n\n`;

        if (structured.writingExercise) {
          markdown += `### 仿写练习\n${structured.writingExercise}\n\n`;
        }
      } else {
        markdown += `${displayContent}\n\n`;
      }

      if (card.originalFacts) {
        markdown += `> **原始事实**：${card.originalFacts}\n\n`;
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
