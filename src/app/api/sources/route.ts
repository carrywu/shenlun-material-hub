import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/api-params";

// GET /api/sources - 获取来源列表（分页筛选 + contentItems 计数）
export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePaginationParams(searchParams);

    const platform = searchParams.get("platform");
    const contentType = searchParams.get("contentType");
    const trustLevel = searchParams.get("trustLevel");
    const isEnabled = searchParams.get("isEnabled");
    const verificationStatus = searchParams.get("verificationStatus");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { archivedAt: null };

    if (platform && platform !== "all") where.platform = platform;
    if (contentType && contentType !== "all") where.contentType = contentType;
    if (trustLevel && trustLevel !== "all") where.trustLevel = trustLevel;
    if (isEnabled && isEnabled !== "all") {
      where.isEnabled = isEnabled === "true";
    }
    if (verificationStatus && verificationStatus !== "all") {
      where.verificationStatus = verificationStatus;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { baseUrl: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.source.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { contentItems: true } },
        },
      }),
      db.source.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch sources:", error);
    return NextResponse.json(
      { error: "获取来源列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/sources - 创建来源
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
    const {
      name,
      externalId,
      platform,
      contentType,
      trustLevel,
      regionScopes,
      baseUrl,
      profileUrl,
      priority,
      collectionMode,
      isEnabled,
      keywords,
      collectionFrequency,
    } = body;

    if (!name || !platform || !contentType || !trustLevel) {
      return NextResponse.json(
        { error: "请填写必填字段：name, platform, contentType, trustLevel" },
        { status: 400 }
      );
    }

    const source = await db.source.create({
      data: {
        name,
        externalId: externalId ?? null,
        platform,
        contentType,
        trustLevel,
        regionScopes: JSON.stringify(regionScopes ?? []),
        baseUrl: baseUrl ?? null,
        profileUrl: profileUrl ?? null,
        priority: priority ?? "P2",
        collectionMode: collectionMode ?? null,
        isEnabled: isEnabled ?? true,
        keywords: JSON.stringify(keywords ?? []),
        collectionFrequency: collectionFrequency ?? null,
      },
      include: {
        _count: { select: { contentItems: true } },
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Failed to create source:", error);
    return NextResponse.json(
      { error: "创建来源失败" },
      { status: 500 }
    );
  }
}
