import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { ownerScopeWhere, mergeWhere } from "@/lib/data-isolation";

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
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (type && type !== "all") where.type = type;

    // Admin can filter by userId to see tasks from a specific user
    const userIdFilter = searchParams.get("userId");
    if (userIdFilter) where.userId = userIdFilter;

    // Multi-user data isolation: for non-ADMIN users, filter by userId
    // (Currently only admins can access this route, but added for future-proofing)
    const ownerFilter = ownerScopeWhere(user, "userId");
    const mergedWhere = mergeWhere(where, ownerFilter);

    const [data, total] = await Promise.all([
      db.asyncTask.findMany({
        where: mergedWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.asyncTask.count({ where: mergedWhere }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取任务列表失败" },
      { status: 500 }
    );
  }
}
