import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  importArticle,
  getImportTaskStatus,
  IMPORT_POLL_TIMEOUT,
  IMPORT_POLL_INTERVAL,
  FEATURED_MP_ID,
} from "@/services/integrations/wechat-rss";
import { fromWeMpRssArticle } from "@/services/collectors/wechat/wechat-article-types";
import { normalizeWeRssArticles } from "@/services/collectors/wechat/weRssNormalizer";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/collectors/wechat/import
// Q6: 改用 we-mp-rss importArticle API + 轮询 task 状态，120s 超时
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

    const baseUrl = process.env.WE_MP_RSS_BASE_URL ?? "";
    const accessKey = process.env.WE_MP_RSS_ACCESS_KEY ?? "";
    const secretKey = process.env.WE_MP_RSS_SECRET_KEY ?? "";

    // 创建 CollectorRun
    const runRecord = await db.collectorRun.create({
      data: {
        sourceId: source.id,
        collectorType: "wechat_manual_import",
        status: "running",
      },
    });

    const errors: string[] = [];
    const importedArticles: Awaited<ReturnType<typeof fromWeMpRssArticle>>[] = [];

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
        // Q6: 调用 we-mp-rss importArticle API（异步任务）
        const taskResult = await importArticle(baseUrl, accessKey, secretKey, url);

        // 轮询任务状态直到完成或超时
        const startTime = Date.now();
        let taskStatus = await getImportTaskStatus(baseUrl, accessKey, secretKey, taskResult.taskId);

        while (
          taskStatus.status !== "SUCCESS" &&
          taskStatus.status !== "FAILED" &&
          (Date.now() - startTime) < IMPORT_POLL_TIMEOUT
        ) {
          await new Promise((resolve) => setTimeout(resolve, IMPORT_POLL_INTERVAL));
          taskStatus = await getImportTaskStatus(baseUrl, accessKey, secretKey, taskResult.taskId);
        }

        if (taskStatus.status === "FAILED") {
          errors.push(`[${url}] 导入失败: ${taskStatus.message ?? "未知错误"}`);
          continue;
        }

        if (taskStatus.status !== "SUCCESS") {
          // 超时
          errors.push(`[${url}] 导入超时（${IMPORT_POLL_TIMEOUT / 1000}秒），请在 we-mp-rss 管理界面查看结果`);
          continue;
        }

        // 导入成功后，从 FEATURED_MP_ID 的文章列表中获取该文章
        const { listArticles } = await import("@/services/integrations/wechat-rss");
        const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
          mpId: FEATURED_MP_ID,
          limit: 10,
        });

        // 找到匹配 URL 的文章
        const matched = articlesData.list.find((a) => a.url === url);
        if (matched) {
          importedArticles.push(fromWeMpRssArticle(matched, source.name));
        } else {
          errors.push(`[${url}] 导入成功但未在精选列表中找到该文章`);
        }
      } catch (err) {
        errors.push(`[${url}] ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 标准化入库
    let result = { discovered: 0, imported: 0, skipped: 0, blocked: 0, errors: [] as string[] };
    if (importedArticles.length > 0) {
      result = await normalizeWeRssArticles(importedArticles, {
        sourceId: source.id,
        trustLevel: source.trustLevel,
        contentType: source.contentType,
      });
    }

    const allErrors = [...errors, ...result.errors];

    await db.collectorRun.update({
      where: { id: runRecord.id },
      data: {
        status: allErrors.length === 0 ? "success" : (importedArticles.length > 0 ? "partial" : "failed"),
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
      blockedCount: result.blocked,
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
