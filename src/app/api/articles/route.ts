import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const source = searchParams.get("source");
    const contentType = searchParams.get("category");
    const topicTags = searchParams.get("tags");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const processingStatus = searchParams.get("processingStatus");
    const sortBy = searchParams.get("sortBy") ?? "createdAt";

    const where: Record<string, unknown> = {};

    if (source) where.platform = source;
    if (contentType) where.contentType = contentType;
    if (topicTags) where.topicTags = { contains: topicTags };
    if (search) where.title = { contains: search };
    if (processingStatus) where.processingStatus = processingStatus;
    if (dateFrom || dateTo) {
      const publishedAt: Record<string, Date> = {};
      if (dateFrom) publishedAt.gte = new Date(dateFrom);
      if (dateTo) publishedAt.lte = new Date(dateTo);
      where.publishedAt = publishedAt;
    }

    // Determine sort order
    let orderBy: Record<string, string>;
    if (sortBy === "aiScore") {
      orderBy = { aiScore: "desc" };
    } else {
      orderBy = { createdAt: "desc" };
    }

    const [data, total] = await Promise.all([
      db.contentItem.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          source: { select: { name: true } },
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
    });
  } catch (error) {
    console.error("Failed to fetch content items:", error);
    return NextResponse.json(
      { error: "获取内容列表失败" },
      { status: 500 }
    );
  }
}
