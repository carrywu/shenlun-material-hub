import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/collectors/mediacrawler/status/[runId]
 *
 * Retrieve the status and details of a MediaCrawler CollectorRun.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const run = await db.collectorRun.findUnique({
      where: { id: runId },
      include: {
        source: {
          select: { id: true, name: true, platform: true },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: "未找到该采集运行记录" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: run.id,
      sourceId: run.sourceId,
      sourceName: run.source.name,
      platform: run.source.platform,
      collectorType: run.collectorType,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      discoveredCount: run.discoveredCount,
      importedCount: run.importedCount,
      errorSummary: run.errorSummary ?? null,
    });
  } catch (error) {
    console.error("MediaCrawler status error:", error);
    return NextResponse.json(
      { error: "查询状态失败" },
      { status: 500 }
    );
  }
}
