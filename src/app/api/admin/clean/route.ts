import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/clean — Execute data cleaning
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { confirm, rules } = body as {
      confirm?: boolean;
      rules?: string[];
    };

    if (!confirm) {
      return NextResponse.json(
        { error: "需要确认才能执行清洗操作" },
        { status: 400 }
      );
    }

    const enabledRules = rules ?? [
      "delete_old_filtered",
      "merge_duplicates",
      "fix_urls",
      "orphan_cards",
    ];

    const results: Record<string, number> = {};
    const logs: string[] = [];

    // Rule 1: Delete filtered content older than 30 days
    if (enabledRules.includes("delete_old_filtered")) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldFiltered = await db.contentItem.findMany({
        where: {
          processingStatus: "filtered",
          createdAt: { lt: thirtyDaysAgo },
        },
        select: { id: true },
      });

      if (oldFiltered.length > 0) {
        await db.contentItem.deleteMany({
          where: {
            id: { in: oldFiltered.map((i) => i.id) },
          },
        });
      }

      results.delete_old_filtered = oldFiltered.length;
      logs.push(`删除 ${oldFiltered.length} 条超过30天的已过滤内容`);
    }

    // Rule 2: Merge duplicate content (keep latest)
    if (enabledRules.includes("merge_duplicates")) {
      // Find duplicate contentHash groups
      const duplicates = await db.$queryRaw<
        Array<{ contentHash: string; cnt: number }>
      >`
        SELECT contentHash, COUNT(*) as cnt
        FROM ContentItem
        WHERE contentHash IS NOT NULL AND contentHash != ''
        GROUP BY contentHash
        HAVING cnt > 1
      `;

      let mergedCount = 0;

      for (const dup of duplicates) {
        const items = await db.contentItem.findMany({
          where: { contentHash: dup.contentHash },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        // Keep the first (newest), mark rest as filtered
        const toMark = items.slice(1);
        if (toMark.length > 0) {
          await db.contentItem.updateMany({
            where: { id: { in: toMark.map((i) => i.id) } },
            data: {
              processingStatus: "filtered",
              filterReason: `与更新的内容重复 (hash: ${dup.contentHash})`,
            },
          });
          mergedCount += toMark.length;
        }
      }

      results.merge_duplicates = mergedCount;
      logs.push(`合并 ${mergedCount} 条重复内容`);
    }

    // Rule 3: Fix empty or malformed URLs
    if (enabledRules.includes("fix_urls")) {
      const badUrls = await db.contentItem.findMany({
        where: {
          OR: [
            { originalUrl: "" },
            { originalUrl: { startsWith: " " } },
            { originalUrl: { endsWith: " " } },
          ],
        },
        select: { id: true, originalUrl: true },
      });

      let fixedCount = 0;
      for (const item of badUrls) {
        const trimmed = item.originalUrl.trim();
        if (trimmed && trimmed !== item.originalUrl) {
          try {
            await db.contentItem.update({
              where: { id: item.id },
              data: { originalUrl: trimmed },
            });
            fixedCount++;
          } catch {
            // URL might conflict with existing entry
            logs.push(`无法修复 URL (可能重复): ${item.id}`);
          }
        }
      }

      results.fix_urls = fixedCount;
      logs.push(`修复 ${fixedCount} 条异常 URL`);
    }

    // Rule 4: Clean orphan material cards
    if (enabledRules.includes("orphan_cards")) {
      // Find material cards whose contentItemId doesn't exist
      const orphanCards = await db.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT mc.id
        FROM MaterialCard mc
        LEFT JOIN ContentItem ci ON mc.contentItemId = ci.id
        WHERE ci.id IS NULL
      `;

      if (orphanCards.length > 0) {
        await db.materialCard.deleteMany({
          where: { id: { in: orphanCards.map((c) => c.id) } },
        });
      }

      results.orphan_cards = orphanCards.length;
      logs.push(`清理 ${orphanCards.length} 张孤立素材卡`);
    }

    const totalAffected = Object.values(results).reduce(
      (sum, count) => sum + count,
      0
    );

    return NextResponse.json({
      success: true,
      results,
      totalAffected,
      logs,
    });
  } catch (error) {
    console.error("Data cleaning error:", error);
    return NextResponse.json(
      { error: `数据清洗失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}

// GET /api/admin/clean — Preview cleaning impact
export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count old filtered content
    const oldFilteredCount = await db.contentItem.count({
      where: {
        processingStatus: "filtered",
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // Count duplicate content groups
    const duplicateGroups = await db.$queryRaw<
      Array<{ cnt: number }>
    >`
      SELECT COUNT(*) as cnt FROM (
        SELECT contentHash
        FROM ContentItem
        WHERE contentHash IS NOT NULL AND contentHash != ''
        GROUP BY contentHash
        HAVING COUNT(*) > 1
      )
    `;
    const duplicateCount = Number(duplicateGroups[0]?.cnt ?? 0);

    // Count bad URLs
    const badUrlCount = await db.contentItem.count({
      where: {
        OR: [
          { originalUrl: "" },
          { originalUrl: { startsWith: " " } },
          { originalUrl: { endsWith: " " } },
        ],
      },
    });

    // Count orphan cards
    const orphanCards = await db.$queryRaw<
      Array<{ cnt: number }>
    >`
      SELECT COUNT(*) as cnt
      FROM MaterialCard mc
      LEFT JOIN ContentItem ci ON mc.contentItemId = ci.id
      WHERE ci.id IS NULL
    `;
    const orphanCardCount = Number(orphanCards[0]?.cnt ?? 0);

    return NextResponse.json({
      preview: {
        delete_old_filtered: oldFilteredCount,
        merge_duplicates: duplicateCount,
        fix_urls: badUrlCount,
        orphan_cards: orphanCardCount,
      },
    });
  } catch (error) {
    console.error("Clean preview error:", error);
    return NextResponse.json(
      { error: "获取清洗预览失败" },
      { status: 500 }
    );
  }
}
