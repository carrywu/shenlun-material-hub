import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
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
