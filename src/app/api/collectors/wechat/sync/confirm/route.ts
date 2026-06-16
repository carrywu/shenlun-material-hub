import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { triggerFeedSync, listArticles, SYNC_ARTICLE_LIMIT } from "@/services/integrations/wechat-rss";
import { fromWeMpRssArticle } from "@/services/collectors/wechat/wechat-article-types";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { logger } from "@/lib/logger";

// POST /api/collectors/wechat/sync/confirm — 确认导入选中的文章
// Q8: confirm 时再调一次 API 重新获取文章，确保最新
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
    const { sourceId, feedId, selectedUrls } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "需要提供 sourceId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(selectedUrls) || selectedUrls.length === 0) {
      return NextResponse.json(
        { error: "需要提供 selectedUrls（至少选一篇文章）" },
        { status: 400 }
      );
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "未找到指定来源" }, { status: 404 });
    }

    if (!source.isEnabled) {
      return NextResponse.json({ error: "该来源已禁用" }, { status: 400 });
    }

    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";
    const mpId = feedId ?? source.feedId;

    // Q8: 重新触发同步并拉取最新文章
    if (mpId) {
      try {
        await triggerFeedSync(baseUrl, accessKey, secretKey, mpId);
      } catch (refreshErr) {
        const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        console.warn(`we-mp-rss sync failed for ${mpId}: ${refreshMsg}`);
      }
    }

    // 重新拉取文章列表
    const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
      mpId: mpId ?? undefined,
      limit: SYNC_ARTICLE_LIMIT,
    });

    // 转换为 WechatArticle 并过滤出用户选中的文章
    const allArticles = articlesData.list.map((a) =>
      fromWeMpRssArticle(a, source.name)
    );

    const selectedSet = new Set(selectedUrls);
    const selectedArticles = allArticles.filter((a) =>
      selectedSet.has(a.url)
    );

    if (selectedArticles.length === 0) {
      return NextResponse.json(
        { error: "未找到匹配的选中文章" },
        { status: 400 }
      );
    }

    // 创建 CollectorRun 记录
    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: "wechat-api",
        status: "running",
      },
    });

    try {
      const result = await normalizeWeRssArticles(selectedArticles, {
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
          errorSummary:
            result.errors.length > 0 ? result.errors.join("\n") : null,
        },
      });

      await db.source.update({
        where: { id: source.id },
        data: {
          lastCollectedAt: new Date(),
          lastError:
            result.errors.length > 0 ? result.errors.join("\n") : null,
        },
      });

      return NextResponse.json({
        success: result.errors.length === 0,
        discoveredCount: result.discovered,
        importedCount: result.imported,
        skippedCount: result.skipped,
        blockedCount: result.blocked,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (syncError) {
      const errorMsg =
        syncError instanceof Error ? syncError.message : String(syncError);
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
    console.error("Confirm import error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
