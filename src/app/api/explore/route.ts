import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth";

// GET /api/explore — 待核验内容 / 关键词搜索（需认证）
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "20"))
    );
    const query = searchParams.get("q") ?? "";
    const platform = searchParams.get("platform");
    const contentType = searchParams.get("contentType");

    // Build where clause — pending verification from unverified/disputed sources
    const where: Record<string, unknown> = {};

    if (query) {
      where.AND = [
        {
          OR: [
            { title: { contains: query } },
            { excerpt: { contains: query } },
            { fullText: { contains: query } },
            { topicTags: { contains: query } },
          ],
        },
      ];
    }

    // Filter for pending verification content
    const pendingFilter = {
      OR: [
        { source: { verificationStatus: { in: ["unverified", "disputed"] } } },
        { processingStatus: "pending" },
      ],
    };

    if (where.AND) {
      (where.AND as Record<string, unknown>[]).push(pendingFilter);
    } else {
      where.AND = [pendingFilter];
    }

    if (platform) where.platform = platform;
    if (contentType) where.contentType = contentType;

    const [data, total] = await Promise.all([
      db.contentItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
      db.contentItem.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      query,
    });
  } catch (error) {
    console.error("Failed to fetch explore content:", error);
    return NextResponse.json(
      { error: "获取探索内容失败" },
      { status: 500 }
    );
  }
}
