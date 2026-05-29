import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WeRssClient } from "@/services/collectors/wechat/weRssClient";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";

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

    const client = new WeRssClient();

    // 创建 CollectorRun 记录
    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: "werss",
        status: "running",
      },
    });

    try {
      // 如果提供了 werssSourceId，先触发 WeRSS 同步
      if (werssSourceId) {
        await client.syncArticles(werssSourceId);
      }

      // 获取文章列表
      const { articles } = await client.getArticles(werssSourceId ?? sourceId);

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
          status: "success",
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
