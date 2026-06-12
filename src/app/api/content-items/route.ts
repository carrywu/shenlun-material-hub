import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin, authErrorResponse } from "@/lib/auth";
import { contentVisibilityWhere, mergeWhere } from "@/lib/data-isolation";

// GET /api/content-items — 分页 + 筛选
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const sourceId = searchParams.get("sourceId");
    const platform = searchParams.get("platform");
    const processingStatus = searchParams.get("processingStatus");
    const contentType = searchParams.get("contentType");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (sourceId) where.sourceId = sourceId;
    if (platform) where.platform = platform;
    if (processingStatus) where.processingStatus = processingStatus;
    if (contentType) where.contentType = contentType;

    // Multi-user data isolation: restrict to visible content
    const visibilityFilter = contentVisibilityWhere(user);

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
      ];
    }

    // Merge visibility filter into where clause
    const mergedWhere = mergeWhere(where, visibilityFilter);

    const [data, total] = await Promise.all([
      db.contentItem.findMany({
        where: mergedWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          source: { select: { id: true, name: true, platform: true } },
          _count: { select: { materialCards: true } },
        },
      }),
      db.contentItem.count({ where: mergedWhere }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch content items:", error);
    return NextResponse.json(
      { error: "获取内容列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/content-items — 手动导入（仅管理员）
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return authErrorResponse(request);
  try {
    const body = await request.json();
    const {
      sourceId,
      title,
      originalUrl,
      contentType,
      platform,
      trustLevel,
      excerpt,
      fullText,
      topicTags,
      regionScopes,
    } = body;

    if (!title || !originalUrl) {
      return NextResponse.json(
        { error: "title 和 originalUrl 为必填项" },
        { status: 400 }
      );
    }

    // P2-4: originalUrl must be a non-empty valid URL (unique constraint)
    const trimmedUrl = String(originalUrl).trim();
    if (!trimmedUrl) {
      return NextResponse.json(
        { error: "originalUrl 不能为空字符串" },
        { status: 400 }
      );
    }

    // P1-12: sourceId 必须是有效 ID 或不传（不传时尝试匹配或创建默认）
    if (sourceId === "") {
      return NextResponse.json(
        { error: "sourceId 不能为空字符串，请传入有效的来源 ID 或不传" },
        { status: 400 }
      );
    }

    // Check duplicate URL
    const existing = await db.contentItem.findUnique({
      where: { originalUrl },
    });
    if (existing) {
      return NextResponse.json(
        { error: "该 URL 已存在" },
        { status: 409 }
      );
    }

    // Resolve source info if sourceId provided
    let resolvedPlatform = platform ?? "website";
    let resolvedContentType = contentType ?? "policy_analysis";
    let resolvedTrustLevel = trustLevel ?? "unverified";

    if (sourceId) {
      const source = await db.source.findUnique({ where: { id: sourceId } });
      if (source) {
        resolvedPlatform = source.platform;
        resolvedContentType = source.contentType;
        resolvedTrustLevel = source.trustLevel;
      }
    }

    const item = await db.contentItem.create({
      data: {
        sourceId: sourceId ?? "",
        title,
        originalUrl,
        ownerUserId: user.id,
        visibility: "public",
        platform: resolvedPlatform,
        contentType: resolvedContentType,
        trustLevel: resolvedTrustLevel,
        excerpt: excerpt ?? null,
        fullText: fullText ?? null,
        fullTextStored: !!fullText,
        effectiveTextLength: fullText ? fullText.length : 0,
        contentHash: fullText ? createHash("sha256").update(fullText).digest("hex").slice(0, 16) : null,
        discoveryChannel: "manual",
        topicTags: topicTags ? JSON.stringify(topicTags) : "[]",
        regionScopes: regionScopes ? JSON.stringify(regionScopes) : "[]",
        processingStatus: fullText ? "fetched" : "pending",
      },
      include: {
        source: { select: { id: true, name: true, platform: true } },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create content item:", error);
    return NextResponse.json(
      { error: "创建内容条目失败" },
      { status: 500 }
    );
  }
}
