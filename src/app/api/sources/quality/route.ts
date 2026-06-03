import { NextResponse } from "next/server";
import { refreshAllSourceMetrics } from "@/services/source-quality";

// POST /api/sources/quality — 刷新所有来源的质量指标
export async function POST() {
  try {
    const count = await refreshAllSourceMetrics();
    return NextResponse.json({ success: true, refreshed: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Refresh source quality error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
