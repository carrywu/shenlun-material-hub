import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { contentVisibilityWhere, mergeWhere } from "@/lib/data-isolation";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
}

// GET /api/discover — 已核验来源的内容，按 publishedAt 降序
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 100);
    const platform = searchParams.get("platform");
    const contentType = searchParams.get("contentType");
    const trustLevel = searchParams.get("trustLevel");

    const where: Record<string, unknown> = {
      source: {
        verificationStatus: "verified",
        isEnabled: true,
        archivedAt: null,
      },
    };

    if (platform) where.platform = platform;
    if (contentType) where.contentType = contentType;
    if (trustLevel) where.trustLevel = trustLevel;

    const user = await getUserFromRequest(request);
    const visibilityFilter = user
      ? contentVisibilityWhere(user)
      : { OR: [{ visibility: "public" }, { ownerUserId: null }] };
    const mergedWhere = mergeWhere(where, visibilityFilter);

    const [data, total] = await Promise.all([
      db.contentItem.findMany({
        where: mergedWhere,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          source: {
            select: {
              id: true,
              name: true,
              platform: true,
              trustLevel: true,
              verificationStatus: true,
            },
          },
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
    console.error("Failed to fetch discover content:", error);
    return NextResponse.json(
      { error: "获取今日推荐失败" },
      { status: 500 }
    );
  }
}
