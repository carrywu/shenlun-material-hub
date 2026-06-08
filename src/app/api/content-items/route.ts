import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";
import { contentVisibilityWhere, mergeWhere } from "@/lib/data-isolation";
import { parsePaginationParams } from "@/lib/api-params";

// GET /api/content-items — 分页 + 筛选
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePaginationParams(searchParams);
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

// POST /api/content-items — 手动导入
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const body = await request.json();
    const {
      sourceId,
      title,
      originalUrl,
      excerpt,
      fullText,
      topicTags,
      regionScopes,
    } = body;

    if (typeof title !== "string" || typeof originalUrl !== "string") {
      return NextResponse.json(
        { error: "title 和 originalUrl 必须为字符串" },
        { status: 400 }
      );
    }

    const trimmedTitle = title.trim();
    const trimmedUrl = originalUrl.trim();
    if (!trimmedTitle || !trimmedUrl) {
      return NextResponse.json(
        { error: "title 和 originalUrl 为必填项" },
        { status: 400 }
      );
    }

    if (typeof sourceId !== "string" || !sourceId.trim()) {
      return NextResponse.json(
        { error: "sourceId 为必填项，请传入有效的来源 ID" },
        { status: 400 }
      );
    }

    const normalizedSourceId = sourceId.trim();

    const source = await db.source.findUnique({ where: { id: normalizedSourceId } });
    if (!source) {
      return NextResponse.json(
        { error: "来源不存在，请传入有效的来源 ID" },
        { status: 404 }
      );
    }

    // Check duplicate URL
    const existing = await db.contentItem.findUnique({
      where: { originalUrl: trimmedUrl },
    });
    if (existing) {
      return NextResponse.json(
        { error: "该 URL 已存在" },
        { status: 409 }
      );
    }

    const normalizedTopicTags = Array.isArray(topicTags) ? topicTags : [];
    const normalizedRegionScopes = Array.isArray(regionScopes) ? regionScopes : [];
    const normalizedFullText = typeof fullText === "string" ? fullText : null;
    const normalizedExcerpt = typeof excerpt === "string" ? excerpt : null;

    const item = await db.contentItem.create({
      data: {
        sourceId: source.id,
        title: trimmedTitle,
        originalUrl: trimmedUrl,
        ownerUserId: user.id,
        visibility: "public",
        platform: source.platform,
        contentType: source.contentType,
        trustLevel: source.trustLevel,
        excerpt: normalizedExcerpt,
        fullText: normalizedFullText,
        fullTextStored: !!normalizedFullText,
        effectiveTextLength: normalizedFullText ? normalizedFullText.length : 0,
        contentHash: normalizedFullText ? createHash("sha256").update(normalizedFullText).digest("hex").slice(0, 16) : null,
        discoveryChannel: "manual",
        topicTags: JSON.stringify(normalizedTopicTags),
        regionScopes: JSON.stringify(normalizedRegionScopes),
        processingStatus: normalizedFullText ? "fetched" : "pending",
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
