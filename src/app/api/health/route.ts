import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/health — public health check for Docker/load balancers.
 * Returns minimal status only: { status: "ok" }
 * Detailed system info requires admin auth via /api/health/detail
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

/**
 * GET /api/health/detail — admin-only detailed health check.
 * Returns database status, AI config status, admin user count.
 */
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const checks: Record<string, string> = {};
  let overallStatus = "ok";

  // Check database connection
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
    overallStatus = "error";
  }

  // Check AI config
  try {
    const aiConfig = await db.aiConfig.findFirst({ where: { isEnabled: true } });
    checks.aiConfig = aiConfig ? "configured" : "not_configured";
  } catch {
    checks.aiConfig = "error";
  }

  // Check admin user exists
  try {
    const adminCount = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    checks.adminUser = adminCount > 0 ? "ok" : "no_admin";
  } catch {
    checks.adminUser = "error";
  }

  return NextResponse.json({
    status: overallStatus,
    checks,
    time: new Date().toISOString(),
    version: "0.1.0",
  }, { status: overallStatus === "ok" ? 200 : 503 });
}
