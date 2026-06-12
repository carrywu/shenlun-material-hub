import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { contentVisibilityWhere, mergeWhere } from "@/lib/data-isolation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // P2-13: safe parseInt with NaN guard
    const safeParseInt = (val: string | null, fallback: number): number => {
      if (!val) return fallback;
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? fallback : n;
    };
    const page = Math.max(1, safeParseInt(searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, safeParseInt(searchParams.get("pageSize"), 20)));

    // 筛选参数
    const keyword = searchParams.get("keyword") ?? searchParams.get("search");
    const sourceType = searchParams.get("sourceType");
    const sourceId = searchParams.get("sourceId");
    const sourceName = searchParams.get("sourceName");
    const section = searchParams.get("section") ?? searchParams.get("categoryName");
    const qualityStatus = searchParams.get("qualityStatus");
    const aiDecision = searchParams.get("aiDecision");
    const adminReviewStatus = searchParams.get("adminReviewStatus");
    const sortBy = searchParams.get("sortBy") ?? "createdAt";

    // 时间范围筛选
    const publishedStart = searchParams.get("publishedStart");
    const publishedEnd = searchParams.get("publishedEnd");
    const collectedStart = searchParams.get("collectedStart");
    const collectedEnd = searchParams.get("collectedEnd");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = {};

    // 关键词搜索：标题 + 摘要
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { excerpt: { contains: keyword } },
      ];
    }

    // 来源筛选
    if (sourceId) {
      where.sourceId = sourceId;
    } else if (sourceName) {
      where.source = { name: { contains: sourceName } };
    }

    // 来源类型筛选
    if (sourceType && sourceType !== "all") {
      if (sourceType === "website") {
        where.platform = "website";
      } else if (sourceType === "wechat") {
        where.platform = "wechat";
      } else if (sourceType === "unknown") {
        where.platform = { notIn: ["website", "wechat"] };
      }
    }

    // 栏目筛选
    if (section) {
      where.section = { contains: section };
    }

    // 质量状态
    if (qualityStatus && qualityStatus !== "all") {
      where.qualityStatus = qualityStatus;
    }

    // AI 评估状态
    if (aiDecision && aiDecision !== "all") {
      if (aiDecision === "pending") {
        where.aiDecision = null;
      } else {
        where.aiDecision = aiDecision;
      }
    }

    // 文章发布时间范围
    if (publishedStart || publishedEnd || dateFrom || dateTo) {
      where.publishedAt = {};
      if (publishedStart) where.publishedAt.gte = new Date(publishedStart);
      if (publishedEnd) where.publishedAt.lte = new Date(publishedEnd + "T23:59:59");
      if (dateFrom) where.publishedAt.gte = new Date(dateFrom);
      if (dateTo) where.publishedAt.lte = new Date(dateTo + "T23:59:59");
    }

    // 采集时间范围（使用 createdAt 作为采集时间）
    if (collectedStart || collectedEnd) {
      where.createdAt = {};
      if (collectedStart) where.createdAt.gte = new Date(collectedStart);
      if (collectedEnd) where.createdAt.lte = new Date(collectedEnd + "T23:59:59");
    }

    // 排序 — always include id as tiebreaker for stable pagination
    let orderBy: Record<string, string>[];
    if (sortBy === "aiScore") {
      orderBy = [{ aiScore: "desc" }, { id: "desc" }];
    } else if (sortBy === "effectiveTextLength") {
      orderBy = [{ effectiveTextLength: "desc" }, { id: "desc" }];
    } else if (sortBy === "publishedAt") {
      orderBy = [{ publishedAt: "desc" }, { id: "desc" }];
    } else {
      orderBy = [{ createdAt: "desc" }, { id: "desc" }];
    }

    // Visibility: authenticated users see public+own+legacy; anonymous see public+legacy(null) only
    const user = await getUserFromRequest(request);
    if (user) {
      where = mergeWhere(where, contentVisibilityWhere(user));
      // P3: ADMIN 可按审核状态筛选；非 ADMIN 由 contentVisibilityWhere 强制 approved
      if (user.role === "ADMIN" && adminReviewStatus && adminReviewStatus !== "all") {
        where.adminReviewStatus = adminReviewStatus;
      }
    } else {
      // P3-final: 匿名用户只看 adminReviewStatus=approved 且 visibility=public
      // 注意：原 P2-14 想包含 legacy visibility:null 行，但 schema 里 visibility 是
      // 非空字段（String @default("public")），Prisma 拒绝 visibility:null 条件
      // （PrismaClientValidationError → 500）。DB 实测 0 行 visibility IS NULL，
      // 该条件零命中且致 500，删除。
      const visibilityFilter = {
        adminReviewStatus: "approved",
        visibility: "public",
      };
      where = mergeWhere(where, visibilityFilter);
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
    console.error("Failed to fetch articles:", error);
    return NextResponse.json(
      { error: "获取文章列表失败" },
      { status: 500 }
    );
  }
}
