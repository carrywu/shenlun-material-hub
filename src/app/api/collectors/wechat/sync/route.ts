import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WeRssClient, fetchStandardRssArticles } from "@/services/collectors/wechat/weRssClient";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { refreshFeed } from "@/services/integrations/wewe-rss";

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

    // 查找本地 source
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

    // 创建 CollectorRun 记录
    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: "werss",
        status: "running",
      },
    });

    try {
      let articles;
      
      const targetUrl = werssSourceId ?? source.baseUrl ?? source.externalId;
      
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        // WeWe RSS 来源：先刷新 feed 再采集
        if (source.provider === "wewe-rss" && source.feedId) {
          const weweBaseUrl = process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
          try {
            await refreshFeed(weweBaseUrl, source.feedId);
          } catch (refreshErr) {
            const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
            console.warn(`WeWe RSS refresh failed for ${source.feedId}: ${refreshMsg}`);
            // 刷新失败不阻塞采集
          }
        }
        // Treat as standard RSS feed
        articles = await fetchStandardRssArticles(targetUrl);
      } else {
        // Fallback to internal WeRSS JSON API
        const client = new WeRssClient();
        if (werssSourceId) {
          await client.syncArticles(werssSourceId);
        }
        const result = await client.getArticles(werssSourceId ?? source.id);
        articles = result.articles;
      }

      // 标准化并导入
      const result = await normalizeWeRssArticles(articles, {
        sourceId: source.id,
        trustLevel: source.trustLevel,
        contentType: source.contentType,
      });

      // 更新 CollectorRun
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

      // 更新 source 的 lastCollectedAt
      await db.source.update({
        where: { id: source.id },
        data: {
          lastCollectedAt: new Date(),
          lastError: result.errors.length > 0 ? result.errors.join("\n") : null,
        },
      });

      return NextResponse.json({
        success: result.errors.length === 0,
        discoveredCount: result.discovered,
        importedCount: result.imported,
        skippedCount: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("WeRSS sync error:", msg);
    return NextResponse.json(
      { error: `WeRSS 同步失败: ${msg}` },
      { status: 500 }
    );
  }
}
