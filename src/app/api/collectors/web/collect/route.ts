import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCollector, listCollectors } from "@/services/collectors/registry";

// POST /api/collectors/web/collect — 触发网页采集
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, sourceName, collectorType } = body;

    if (!sourceId && !sourceName && !collectorType) {
      return NextResponse.json(
        { error: "需要提供 sourceId、sourceName 或 collectorType" },
        { status: 400 }
      );
    }

    // 查找 source
    let source;
    if (sourceId) {
      source = await db.source.findUnique({ where: { id: sourceId } });
    } else if (sourceName) {
      source = await db.source.findFirst({
        where: { name: sourceName, platform: "website" },
      });
    }

    if (!source) {
      return NextResponse.json(
        { error: "未找到指定来源" },
        { status: 404 }
      );
    }

    if (!source.isEnabled) {
      return NextResponse.json(
        { error: "该来源已禁用" },
        { status: 400 }
      );
    }

    // 查找采集器
    const collector = getCollector({
      name: source.name,
      collectorType: collectorType ?? undefined,
    });

    if (!collector) {
      return NextResponse.json(
        {
          error: `未找到匹配的采集器，可用采集器: ${listCollectors()
            .map((c) => c.name)
            .join(", ")}`,
        },
        { status: 404 }
      );
    }

    // 执行采集
    const result = await collector.run({
      id: source.id,
      name: source.name,
      platform: source.platform,
      contentType: source.contentType,
      trustLevel: source.trustLevel,
      baseUrl: source.baseUrl,
    });

    return NextResponse.json({
      success: result.errors.length === 0,
      collectorType: result.collectorType,
      sourceName: source.name,
      discoveredCount: result.discoveredCount,
      importedCount: result.importedCount,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("Collector error:", error);
    return NextResponse.json(
      { error: "采集执行失败" },
      { status: 500 }
    );
  }
}

// GET /api/collectors/web/collect — 列出可用采集器
export async function GET() {
  return NextResponse.json({
    collectors: listCollectors(),
  });
}
