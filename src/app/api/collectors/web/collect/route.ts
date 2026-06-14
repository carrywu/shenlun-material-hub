import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";
import { listCollectors, getCollector } from "@/services/collectors/registry";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

interface WebCollectTaskParams {
  scope: "all-enabled-website-sources" | "single-source";
  sourceId?: string;
  sourceName?: string;
  collectorType?: string | null;
}

async function runAllEnabledWebsiteSourcesTask() {
  const sources = await db.source.findMany({
    where: { platform: "website", isEnabled: true },
  });

  let totalDiscovered = 0;
  let totalImported = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];
  const results: Array<{ sourceName: string; discovered: number; imported: number; skipped?: number; error?: string }> = [];

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
      totalSkipped += result.skippedCount ?? 0;
      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
      }

      results.push({
        sourceName: source.name,
        discovered: result.discoveredCount,
        imported: result.importedCount,
        skipped: result.skippedCount,
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

  return {
    success: allErrors.length === 0,
    sourceCount: sources.length,
    discoveredCount: totalDiscovered,
    importedCount: totalImported,
    skippedCount: totalSkipped,
    results,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}

async function runSingleWebsiteSourceTask(params: WebCollectTaskParams) {
  const source = await db.source.findUnique({
    where: { id: params.sourceId },
  });

  if (!source) {
    throw new Error("未找到指定来源");
  }

  const collector = getCollector({
    name: source.name,
    collectorType: params.collectorType ?? undefined,
  });

  if (!collector) {
    throw new Error(
      `未找到匹配的采集器，可用采集器: ${listCollectors()
        .map((item) => item.name)
        .join(", ")}`
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

  return {
    success: result.errors.length === 0,
    collectorType: result.collectorType,
    sourceName: source.name,
    discoveredCount: result.discoveredCount,
    importedCount: result.importedCount,
    skippedCount: result.skippedCount ?? 0,
    errors: result.errors.length > 0 ? result.errors : undefined,
  };
}

async function runWebCollectTask(params: WebCollectTaskParams) {
  if (params.scope === "all-enabled-website-sources") {
    return runAllEnabledWebsiteSourcesTask();
  }

  return runSingleWebsiteSourceTask(params);
}

// POST /api/collectors/web/collect — 触发网页采集
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { sourceId, sourceName, collectorType } = body;

    if (!sourceId && !sourceName && !collectorType) {
      const sources = await db.source.findMany({
        where: { platform: "website", isEnabled: true },
        select: { id: true },
      });

      if (sources.length === 0) {
        return NextResponse.json(
          { error: "没有启用的 website 来源" },
          { status: 400 }
        );
      }

      const task = await createAsyncTask("WEB_CRAWL", {
        scope: "all-enabled-website-sources",
        sourceCount: sources.length,
      }, user.id);

      enqueueAsyncTask(task, () =>
        runWebCollectTask({
          scope: "all-enabled-website-sources",
        })
      );

      return NextResponse.json(
        {
          success: true,
          accepted: true,
          taskId: task.id,
          status: "PENDING",
          message: `已加入后台采集队列，将处理 ${sources.length} 个来源`,
        },
        { status: 202 }
      );
    }

    let source = null;
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
            .map((item) => item.name)
            .join(", ")}`,
        },
        { status: 404 }
      );
    }

    const task = await createAsyncTask("WEB_CRAWL", {
      scope: "single-source",
      sourceId: source.id,
      sourceName: source.name,
      collectorType: collectorType ?? null,
    }, user.id);

    enqueueAsyncTask(task, () =>
      runWebCollectTask({
        scope: "single-source",
        sourceId: source.id,
        sourceName: source.name,
        collectorType: collectorType ?? null,
      })
    );

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        taskId: task.id,
        status: "PENDING",
        sourceName: source.name,
        message: `已加入后台采集队列：${source.name}`,
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "采集执行失败" },
      { status: 500 }
    );
  }
}

// GET /api/collectors/web/collect — 列出可用采集器
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  return NextResponse.json({
    collectors: listCollectors(),
  });
}
