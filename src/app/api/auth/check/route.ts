import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig, verifyJWT } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authConfigResult = getAuthConfig();
    if (!authConfigResult.ok) {
      return NextResponse.json({ authenticated: false, error: authConfigResult.message }, { status: 500 });
    }

    const token = req.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = await verifyJWT(token, authConfigResult.config.jwtSecret);
    
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      username: typeof payload.username === "string" ? payload.username : "",
    });
  } catch (_error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
