import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  WeRssClient,
  fetchStandardRssArticles,
} from "@/services/collectors/wechat/weRssClient";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { refreshFeed } from "@/services/integrations/wewe-rss-api";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { logger } from "@/lib/logger";

// POST /api/collectors/wechat/sync/confirm — 确认导入选中的文章
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
    const { sourceId, werssSourceId, selectedUrls } = body;

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

    // 先刷新 WeWe RSS 缓存，确保获取最新内容（与 sync/route.ts、preview/route.ts 一致）
    if (source.provider === "wewe-rss" && source.feedId) {
      const weweBaseUrl = process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
      try {
        await refreshFeed(weweBaseUrl, source.feedId);
      } catch (refreshErr) {
        const refreshMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        console.warn(`WeWe RSS refresh failed for ${source.feedId}: ${refreshMsg}`);
      }
    }

    // 重新拉取文章
    const targetUrl = werssSourceId ?? source.baseUrl ?? source.externalId;
    let allArticles;
    if (
      targetUrl &&
      (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))
    ) {
      allArticles = await fetchStandardRssArticles(targetUrl);
    } else {
      const client = new WeRssClient();
      const result = await client.getArticles(werssSourceId ?? source.id);
      allArticles = result.articles;
    }

    // 过滤出用户选中的文章
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
        collectorType: "werss",
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
        refreshedCount: result.refreshed,
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
