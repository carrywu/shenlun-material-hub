import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAsyncTask, enqueueAsyncTask } from "@/lib/async-task";
import { logger } from "@/lib/logger";
import { triggerFeedSync, listArticles, SYNC_ARTICLE_LIMIT } from "@/services/integrations/wechat-rss";
import { fromWeMpRssArticle } from "@/services/collectors/wechat/wechat-article-types";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

interface WechatSyncTaskParams {
  sourceId: string;
  feedId?: string | null;
}

async function runWechatSyncTask(params: WechatSyncTaskParams) {
  const source = await db.source.findUnique({ where: { id: params.sourceId } });
  if (!source) {
    throw new Error("未找到指定来源");
  }

  const runRecord = await db.collectorRun.create({
    data: {
      sourceId: source.id,
      collectorType: "wechat-api",
      status: "running",
    },
  });

  const startedAtMs = Date.now();
  await logger.info("采集任务开始", "CRAWLER", {
    source: source.name,
    sourceId: source.id,
    collectorType: "wechat-api",
  });

  try {
    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";
    const feedId = params.feedId ?? source.feedId;

    // 1. 触发 we-mp-rss 同步该公众号
    if (feedId) {
      try {
        await triggerFeedSync(baseUrl, accessKey, secretKey, feedId);
      } catch (refreshErr) {
        const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        console.warn(`we-mp-rss sync failed for ${feedId}: ${refreshMsg}`);
        // 同步触发失败不阻塞采集，继续用已有数据
      }
    }

    // 2. 通过 API 获取文章列表
    if (!feedId) {
      throw new Error("该来源缺少 feedId，无法通过 we-mp-rss API 获取文章");
    }
    const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
      mpId: feedId,
      limit: SYNC_ARTICLE_LIMIT,
    });

    // 3. 转换为 WechatArticle 并入库
    const wechatArticles = articlesData.list.map((a) =>
      fromWeMpRssArticle(a, source.name)
    );
    const result = await normalizeWeRssArticles(wechatArticles, {
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

    await logger.info("采集任务完成", "CRAWLER", {
      source: source.name,
      sourceId: source.id,
      discovered: result.discovered,
      imported: result.imported,
      skipped: result.skipped,
      blocked: result.blocked,
      durationMs: Date.now() - startedAtMs,
    });

    return {
      success: result.errors.length === 0,
      discoveredCount: result.discovered,
      importedCount: result.imported,
      skippedCount: result.skipped,
      blockedCount: result.blocked,
      errors: result.errors.length > 0 ? result.errors : undefined,
      sourceName: source.name,
    };
  } catch (syncError) {
    const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);

    await logger.error("采集任务失败", "CRAWLER", {
      source: source.name,
      sourceId: source.id,
      error: errorMsg,
      durationMs: Date.now() - startedAtMs,
    });

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

// POST /api/collectors/wechat/sync — 触发微信采集同步并导入为 ContentItem
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
    const body = await request.json();
    const { sourceId, feedId } = body;

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

    const task = await createAsyncTask("WECHAT_SYNC", {
      sourceId: source.id,
      sourceName: source.name,
      feedId: feedId ?? source.feedId ?? null,
    });

    enqueueAsyncTask(task, () =>
      runWechatSyncTask({
        sourceId: source.id,
        feedId: feedId ?? source.feedId ?? null,
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
      { error: `微信采集同步失败: ${msg}` },
      { status: 500 }
    );
  }
}
