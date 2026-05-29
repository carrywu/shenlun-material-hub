import { NextRequest, NextResponse } from "next/server";
import { runCollectAll, runCollectSource } from "@/services/collector-scheduler";

// POST /api/collect — 触发采集（全部或指定来源）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = body.source as string | undefined;

    if (source) {
      const result = await runCollectSource(source);
      return NextResponse.json({ success: true, results: [result] });
    }

    const results = await runCollectAll();
    return NextResponse.json({ success: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "采集失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
