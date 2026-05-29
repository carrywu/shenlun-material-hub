import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const source = searchParams.get("source");
    const category = searchParams.get("category");
    const tags = searchParams.get("tags");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (source) where.source = source;
    if (category) where.category = category;
    if (tags) where.tags = { contains: tags };
    if (search) where.title = { contains: search };
    if (dateFrom || dateTo) {
      const publishedAt: Record<string, Date> = {};
      if (dateFrom) publishedAt.gte = new Date(dateFrom);
      if (dateTo) publishedAt.lte = new Date(dateTo);
      where.publishedAt = publishedAt;
    }

    const [data, total] = await Promise.all([
      db.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { materialCards: true } } },
      }),
      db.article.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch articles:", error);
    return NextResponse.json(
      { error: "获取文章列表失败" },
      { status: 500 }
    );
  }
}
