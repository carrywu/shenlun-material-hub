import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSession } from "./lib/auth";

const PUBLIC_LOGIN_PAGE = "/admin/login";

// Paths that never require authentication (login pages, auth endpoints)
const ALWAYS_PUBLIC = [
  "/admin/login",
  "/api/auth/login",
  "/api/auth/check",
  "/api/auth/logout",
];

// Page routes that allow anonymous access (non-API, browser-visible pages)
const PUBLIC_PAGES = [
  "/articles",       // 文章列表（公开浏览）
  "/discover",       // 今日推荐（公开内容源）
  "/explore",        // 探索区（未验证来源）
  "/search",         // 素材卡检索
  "/review",         // 复习模式
  "/cards",          // 素材卡浏览
  "/register",       // 用户注册
];

// API routes that allow anonymous access (public data feeds)
const PUBLIC_APIS = [
  "/api/articles",       // 文章列表 API
  "/api/discover",       // 推荐内容 API
  "/api/explore",        // 探索内容 API
  "/api/search",         // 搜索 API
  "/api/health",         // 健康检查
  "/api/auth/register",  // 注册 API
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
    // Check if this API is in the explicit public whitelist
    const isPublicApi = PUBLIC_APIS.some(
      (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
    );
    if (isPublicApi) {
      return NextResponse.next();
    }

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

  // ── Public pages: allow anonymous access ──────────────────────────────────
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
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
