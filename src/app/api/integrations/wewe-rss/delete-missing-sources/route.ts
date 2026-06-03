import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/integrations/wewe-rss/delete-missing-sources — 删除 WeWe RSS 中已不存在的来源
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceIds, deleteContentItems = false } = body;

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json(
        { error: "需要提供 sourceIds 数组" },
        { status: 400 }
      );
    }

    // 安全检查：只允许删除 provider=wewe-rss 的来源
    const sources = await db.source.findMany({
      where: {
        id: { in: sourceIds },
        provider: "wewe-rss",
        archivedAt: null,
      },
      select: { id: true, name: true, feedId: true },
    });

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有可删除的 WeWe RSS 来源",
        deleted: 0,
        contentItemsDeleted: 0,
      });
    }

    // 检查是否有非 wewe-rss 的来源被误传
    const allowedIds = new Set(sources.map((s) => s.id));
    const rejectedIds = sourceIds.filter((id: string) => !allowedIds.has(id));

    let contentItemsDeleted = 0;

    if (deleteContentItems) {
      // 删除关联的 ContentItem
      const deleteResult = await db.contentItem.deleteMany({
        where: { sourceId: { in: sources.map((s) => s.id) } },
      });
      contentItemsDeleted = deleteResult.count;
    }

    // 删除来源（软删除：标记 archivedAt）
    await db.source.updateMany({
      where: { id: { in: sources.map((s) => s.id) } },
      data: { archivedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `已删除 ${sources.length} 个 WeWe RSS 来源`,
      deleted: sources.length,
      contentItemsDeleted,
      rejectedIds: rejectedIds.length > 0 ? rejectedIds : undefined,
      deletedSources: sources.map((s) => ({ id: s.id, name: s.name, feedId: s.feedId })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Delete missing sources error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
