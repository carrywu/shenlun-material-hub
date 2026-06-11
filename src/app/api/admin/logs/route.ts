import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

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
    const level = searchParams.get("level");
    const category = searchParams.get("category");
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Stats mode: return 24h error/warn counts
    if (searchParams.get("stats") === "true") {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [errorCount, warnCount] = await Promise.all([
        db.systemLog.count({ where: { level: "ERROR", createdAt: { gte: past24h } } }),
        db.systemLog.count({ where: { level: "WARN", createdAt: { gte: past24h } } }),
      ]);
      return NextResponse.json({ errorCount, warnCount });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (level && level !== "all") where.level = level;
    if (category && category !== "all") where.category = category;

    // 关键词模糊搜索（message / detail），用于按来源名、标题、URL 检索采集日志
    if (q) {
      where.OR = [
        { message: { contains: q, mode: "insensitive" } },
        { detail: { contains: q, mode: "insensitive" } },
      ];
    }

    // Time range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59");
    }

    const [data, total] = await Promise.all([
      db.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.systemLog.count({ where }),
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
      { error: error instanceof Error ? error.message : "获取日志失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const olderThanDays = Number(searchParams.get("olderThanDays") ?? "0");

    const where =
      olderThanDays > 0
        ? {
            createdAt: {
              lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000),
            },
          }
        : {};

    const result = await db.systemLog.deleteMany({ where });
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "清理日志失败" },
      { status: 500 }
    );
  }
}
