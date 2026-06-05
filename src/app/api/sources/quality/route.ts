import { NextRequest, NextResponse } from "next/server";
import { refreshAllSourceMetrics } from "@/services/source-quality";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// POST /api/sources/quality — 刷新所有来源的质量指标
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return unauthorizedResponse();
    }
    return forbiddenResponse();
  }
  try {
    const count = await refreshAllSourceMetrics();
    return NextResponse.json({ success: true, refreshed: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Refresh source quality error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
