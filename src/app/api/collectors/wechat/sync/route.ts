import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";
import { WeRssClient, fetchStandardRssArticles } from "@/services/collectors/wechat/weRssClient";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { refreshFeed } from "@/services/integrations/wewe-rss-api";

interface WechatSyncTaskParams {
  sourceId: string;
  werssSourceId?: string | null;
}

async function runWechatSyncTask(params: WechatSyncTaskParams) {
  const source = await db.source.findUnique({ where: { id: params.sourceId } });
  if (!source) {
    throw new Error("未找到指定来源");
  }

  const runRecord = await db.collectorRun.create({
    data: {
      sourceId: source.id,
      collectorType: "werss",
      status: "running",
    },
  });

  try {
    let articles;
    const targetUrl = params.werssSourceId ?? source.baseUrl ?? source.externalId;

    if (
      targetUrl &&
      (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))
    ) {
      if (source.provider === "wewe-rss" && source.feedId) {
        const weweBaseUrl = process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
        try {
          await refreshFeed(weweBaseUrl, source.feedId);
        } catch (refreshErr) {
          const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
          console.warn(`WeWe RSS refresh failed for ${source.feedId}: ${refreshMsg}`);
        }
      }
      articles = await fetchStandardRssArticles(targetUrl);
    } else {
      const client = new WeRssClient();
      if (params.werssSourceId) {
        await client.syncArticles(params.werssSourceId);
      }
      const result = await client.getArticles(params.werssSourceId ?? source.id);
      articles = result.articles;
    }

    const result = await normalizeWeRssArticles(articles, {
      sourceId: source.id,
      trustLevel: source.trustLevel,
      contentType: source.contentType,
    });

    await db.collectorRun.update({
      where: { id: runRecord.id },
      data: {
        status: result.errors.length > 0 ? "partial" : "success",
        finishedAt: new Date(),
        discoveredCount: result.discovered,
        importedCount: result.imported,
        errorSummary: result.errors.length > 0 ? result.errors.join("\n") : null,
      },
    });

    await db.source.update({
      where: { id: source.id },
      data: {
        lastCollectedAt: new Date(),
        lastError: result.errors.length > 0 ? result.errors.join("\n") : null,
      },
    });

    return {
      success: result.errors.length === 0,
      discoveredCount: result.discovered,
      importedCount: result.imported,
      skippedCount: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
      sourceName: source.name,
    };
  } catch (syncError) {
    const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);

    await db.collectorRun.update({
      where: { id: runRecord.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorSummary: errorMsg,
      },
    });

    await db.source.update({
      where: { id: source.id },
      data: { lastError: errorMsg },
    });

    throw syncError;
  }
}

// POST /api/collectors/wechat/sync — 触发 WeRSS 同步并导入为 ContentItem
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, werssSourceId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "需要提供 sourceId（本地 Source 记录 ID）" },
        { status: 400 }
      );
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
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

    const task = await createAsyncTask("WEWE_RSS_SYNC", {
      sourceId: source.id,
      sourceName: source.name,
      werssSourceId: werssSourceId ?? null,
    });

    enqueueAsyncTask(task, () =>
      runWechatSyncTask({
        sourceId: source.id,
        werssSourceId: werssSourceId ?? null,
      })
    );

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        taskId: task.id,
        status: "PENDING",
        sourceName: source.name,
        message: `已加入后台同步队列：${source.name}`,
      },
      { status: 202 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `WeRSS 同步失败: ${msg}` },
      { status: 500 }
    );
  }
}
