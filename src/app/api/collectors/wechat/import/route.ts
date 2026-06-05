import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWechatArticle } from "@/services/collectors/wechat/wechatParser";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/collectors/wechat/import
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
    const { urls, sourceId } = body as { urls: string[]; sourceId: string };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "请提供至少一个文章链接 (urls 数组)" },
        { status: 400 }
      );
    }
    
    if (!sourceId) {
      return NextResponse.json(
        { error: "请提供关联的来源 ID (sourceId)" },
        { status: 400 }
      );
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: "来源不存在" }, { status: 404 });
    }

    // 创建 CollectorRun
    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: "wechat_manual_import",
        status: "running",
      },
    });

    const parsedArticles = [];
    const errors: string[] = [];

    for (const url of urls) {
      // 前置校验：只接受 mp.weixin.qq.com 链接
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== "mp.weixin.qq.com") {
          errors.push(`[${url}] 不支持的链接域名: ${parsed.hostname}，仅支持 mp.weixin.qq.com`);
          continue;
        }
      } catch {
        errors.push(`[${url}] 无效的链接格式`);
        continue;
      }

      try {
        const article = await parseWechatArticle(url);
        parsedArticles.push(article);
      } catch (err) {
        errors.push(`[${url}] ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 标准化入库
    let result = { discovered: 0, imported: 0, skipped: 0, errors: [] as string[] };
    if (parsedArticles.length > 0) {
       result = await normalizeWeRssArticles(parsedArticles, {
         sourceId: source.id,
         trustLevel: source.trustLevel,
         contentType: source.contentType,
       });
    }

    const allErrors = [...errors, ...result.errors];

    await db.collectorRun.update({
      where: { id: runRecord.id },
      data: {
        status: allErrors.length === 0 ? "success" : (parsedArticles.length > 0 ? "partial" : "failed"),
        finishedAt: new Date(),
        discoveredCount: urls.length,
        importedCount: result.imported,
        errorSummary: allErrors.length > 0 ? allErrors.join("\n") : null,
      },
    });

    return NextResponse.json({
      success: allErrors.length === 0,
      discoveredCount: urls.length,
      importedCount: result.imported,
      skippedCount: result.skipped,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error("WeChat manual import error:", error);
    return NextResponse.json(
      { error: "导入执行失败" },
      { status: 500 }
    );
  }
}
