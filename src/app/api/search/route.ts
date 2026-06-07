import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";
import { ownerScopeWhere, mergeWhere } from "@/lib/data-isolation";

// GET /api/search - 全文搜索素材卡
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return authErrorResponse(request);
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const cardType = searchParams.get("category");
    const tags = searchParams.get("tags");
    const confirmed = searchParams.get("confirmed");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "20"))
    );

    const where: Record<string, unknown> = {};

    if (query) {
      where.OR = [
        { title: { contains: query } },
        { aiSummary: { contains: query } },
        { markdownContent: { contains: query } },
        { originalFacts: { contains: query } },
      ];
    }

    if (cardType) {
      where.cardType = cardType;
    }

    if (tags) {
      const tagList = tags.split(",").filter(Boolean);
      if (tagList.length > 0) {
        where.AND = tagList.map((tag) => ({
          sourceSnapshot: { contains: tag.trim() },
        }));
      }
    }

    if (confirmed !== null && confirmed !== undefined && confirmed !== "all") {
      where.confirmed = confirmed === "true";
    }

    // Multi-user data isolation: restrict to owned cards
    // Multi-user data isolation: restrict to owned cards
    const ownerFilter = ownerScopeWhere(user);
    const mergedWhere = mergeWhere(where, ownerFilter);

    const [data, total] = await Promise.all([
      db.materialCard.findMany({
        where: mergedWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contentItem: {
            select: {
              id: true,
              title: true,
              source: { select: { name: true } },
            },
          },
        },
      }),
      db.materialCard.count({ where: mergedWhere }),
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
    console.error("Search failed:", error);
    return NextResponse.json({ error: "搜索失败" }, { status: 500 });
  }
}
