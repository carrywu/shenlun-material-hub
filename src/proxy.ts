import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthConfig, verifyJWT } from "./lib/auth";

const PROTECTED_PAGE_PREFIX = "/admin";
const PUBLIC_LOGIN_PAGE = "/admin/login";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  const authConfigResult = getAuthConfig();
  const isAiTaskApi =
    pathname === "/api/content-items/assess" ||
    /^\/api\/content-items\/[^/]+\/generate-card$/.test(pathname);
  const isProtectedApi =
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/collectors") ||
    pathname.startsWith("/api/ai-config") ||
    pathname.startsWith("/api/integrations") ||
    isAiTaskApi ||
    (pathname.startsWith("/api/sources") && method !== "GET");

  if (!authConfigResult.ok) {
    if (pathname.startsWith(PROTECTED_PAGE_PREFIX) || isProtectedApi) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: authConfigResult.message }, { status: 503 });
      }
      return new NextResponse(authConfigResult.message, { status: 503 });
    }
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_token")?.value;
  let decodedToken = null;
  if (token) {
    decodedToken = await verifyJWT(token, authConfigResult.config.jwtSecret);
  }

  if (pathname.startsWith(PROTECTED_PAGE_PREFIX)) {
    if (pathname === PUBLIC_LOGIN_PAGE) {
      if (decodedToken) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.next();
    }

    if (!decodedToken) {
      return NextResponse.redirect(new URL(PUBLIC_LOGIN_PAGE, req.url));
    }

    return NextResponse.next();
  }

  if (isProtectedApi && !decodedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
