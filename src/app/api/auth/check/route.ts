import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      username: user.username,
      role: user.role,
      displayName: user.displayName || user.username,
    });
  } catch (_error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
