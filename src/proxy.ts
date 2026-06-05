import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSession } from "./lib/auth";

const PUBLIC_LOGIN_PAGE = "/admin/login";

// Paths that never require authentication
const ALWAYS_PUBLIC = [
  "/admin/login",
  "/api/auth/login",
  "/api/auth/check",
  "/api/auth/logout",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_static") ||
    pathname.startsWith("/static") ||
    pathname.includes("/_error") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Skip always-public paths
  if (ALWAYS_PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // Already logged in? Redirect login page to homepage
    if (pathname === "/admin/login") {
      const token = req.cookies.get("auth_token")?.value;
      if (token) {
        const user = await validateSession(token);
        if (user) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }
    }
    return NextResponse.next();
  }

  // ── Validate session ──────────────────────────────────────────────────────
  const token = req.cookies.get("auth_token")?.value;
  let authenticatedUser = null;
  if (token) {
    authenticatedUser = await validateSession(token);
  }

  // ── API routes: return 401 JSON for protected endpoints ───────────────────
  if (pathname.startsWith("/api/")) {
    const isAiTaskApi =
      pathname === "/api/content-items/assess" ||
      pathname === "/api/content-items/reassess" ||
      /^\/api\/content-items\/[^/]+\/generate-card$/.test(pathname) ||
      /^\/api\/content-items\/[^/]+\/score$/.test(pathname);
    const isProtectedApi =
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/collectors") ||
      pathname.startsWith("/api/ai-config") ||
      pathname.startsWith("/api/integrations") ||
      isAiTaskApi ||
      (pathname.startsWith("/api/sources") && method !== "GET");

    if (isProtectedApi && !authenticatedUser) {
      return NextResponse.json({ error: "未登录或会话已过期" }, { status: 401 });
    }

    return NextResponse.next();
  }

  // ── All page routes: redirect to login if unauthenticated ─────────────────
  if (!authenticatedUser) {
    const loginUrl = new URL(PUBLIC_LOGIN_PAGE, req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except _next/static, _next/image, favicon.ico
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
