import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { triggerFeedSync, listArticles, REFRESH_RATE_LIMIT_S } from "@/services/integrations/wechat-rss";
import { fromWeMpRssArticle } from "@/services/collectors/wechat/wechat-article-types";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/integrations/wechat-rss/refresh-source — 刷新并采集单个 we-mp-rss 来源
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
    const { sourceId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "需要提供 sourceId" },
        { status: 400 }
      );
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "未找到来源" }, { status: 404 });
    }

    if (!source.isEnabled) {
      return NextResponse.json({ error: "该来源已禁用" }, { status: 400 });
    }

    if (source.provider !== "we-mp-rss" || !source.feedId) {
      return NextResponse.json(
        { error: "该来源不是 we-mp-rss 来源" },
        { status: 400 }
      );
    }

    // Q9: 后端 60 秒限流
    if (source.lastCollectedAt) {
      const elapsed = (Date.now() - source.lastCollectedAt.getTime()) / 1000;
      if (elapsed < REFRESH_RATE_LIMIT_S) {
        return NextResponse.json(
          { error: `刷新频率限制：请等待 ${Math.ceil(REFRESH_RATE_LIMIT_S - elapsed)} 秒后再试` },
          { status: 429 }
        );
      }
    }

    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";

    // 1. 先触发 we-mp-rss 同步该公众号
    try {
      await triggerFeedSync(baseUrl, accessKey, secretKey, source.feedId);
    } catch (refreshErr) {
      const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
      console.warn(`we-mp-rss sync failed for ${source.feedId}: ${msg}`);
      // 同步触发失败不阻塞采集，继续用已有数据
    }

    // 2. 通过 API 获取文章列表
    const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
      mpId: source.feedId,
      limit: 100,
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

    // 4. 更新 source 状态
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
      refreshedCount: result.refreshed,
      skippedCount: result.skipped,
      blockedCount: result.blocked,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("we-mp-rss refresh-source error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
