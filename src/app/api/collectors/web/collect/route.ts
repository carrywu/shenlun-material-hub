import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCollector, listCollectors } from "@/services/collectors/registry";

// POST /api/collectors/web/collect — 触发网页采集
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sourceId, sourceName, collectorType } = body;

    // 如果没有指定来源，采集所有启用的 website 来源
    if (!sourceId && !sourceName && !collectorType) {
      const sources = await db.source.findMany({
        where: { platform: "website", isEnabled: true },
      });

      if (sources.length === 0) {
        return NextResponse.json(
          { error: "没有启用的 website 来源" },
          { status: 400 }
        );
      }

      let totalDiscovered = 0;
      let totalImported = 0;
      const allErrors: string[] = [];
      const results: Array<{ sourceName: string; discovered: number; imported: number; error?: string }> = [];

      for (const source of sources) {
        const collector = getCollector({ name: source.name });
        if (!collector) {
          results.push({
            sourceName: source.name,
            discovered: 0,
            imported: 0,
            error: "未找到匹配的采集器",
          });
          continue;
        }

        try {
          const result = await collector.run({
            id: source.id,
            name: source.name,
            platform: source.platform,
            contentType: source.contentType,
            trustLevel: source.trustLevel,
            baseUrl: source.baseUrl,
          });

          totalDiscovered += result.discoveredCount;
          totalImported += result.importedCount;
          if (result.errors.length > 0) {
            allErrors.push(...result.errors);
          }

          results.push({
            sourceName: source.name,
            discovered: result.discoveredCount,
            imported: result.importedCount,
            error: result.errors.length > 0 ? result.errors[0] : undefined,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "采集失败";
          allErrors.push(`[${source.name}] ${msg}`);
          results.push({
            sourceName: source.name,
            discovered: 0,
            imported: 0,
            error: msg,
          });
        }
      }

      return NextResponse.json({
        success: allErrors.length === 0,
        sourceCount: sources.length,
        discoveredCount: totalDiscovered,
        importedCount: totalImported,
        results,
        errors: allErrors.length > 0 ? allErrors : undefined,
      });
    }

    // 单来源采集
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
