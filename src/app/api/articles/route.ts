import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/articles — 查询文章列表（分页、筛选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10))
    );
    const source = searchParams.get("source") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const keyword = searchParams.get("keyword") ?? undefined;

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (source) where.source = source;
    if (category) where.category = category;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ];
    }

    const [data, total] = await Promise.all([
      db.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          url: true,
          source: true,
          summary: true,
          category: true,
          tags: true,
          publishedAt: true,
          createdAt: true,
        },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
