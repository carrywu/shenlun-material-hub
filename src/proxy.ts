import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSession } from "./lib/auth";

const ADMIN_LOGIN_PAGE = "/admin/login";
const FRONTEND_LOGIN_PAGE = "/login";

// Paths that never require authentication (login pages, auth endpoints)
const ALWAYS_PUBLIC = [
  "/login",
  "/admin/login",
  "/api/auth/login",
  "/api/auth/check",
  "/api/auth/logout",
];

// Page routes that allow anonymous access (non-API, browser-visible pages)
// 注意：/articles、/cards、/search、/review 需要登录，不在此列表中
const PUBLIC_PAGES = [
  "/register",       // 用户注册
];

// API routes that allow anonymous access (public data feeds)
const PUBLIC_APIS = [
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
    // 已登录用户访问任一登录页 → 跳走
    if (pathname === ADMIN_LOGIN_PAGE || pathname === FRONTEND_LOGIN_PAGE) {
      const token = req.cookies.get("auth_token")?.value;
      if (token) {
        const user = await validateSession(token);
        if (user) {
          const dest = pathname === ADMIN_LOGIN_PAGE ? "/admin" : "/articles";
          return NextResponse.redirect(new URL(dest, req.url));
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

  // ── All page routes: redirect to appropriate login if unauthenticated ─────
  if (!authenticatedUser) {
    // 后台页面 → /admin/login；前台页面 → /login
    const isAdminRoute = pathname.startsWith("/admin");
    const loginPage = isAdminRoute ? ADMIN_LOGIN_PAGE : FRONTEND_LOGIN_PAGE;
    const loginUrl = new URL(loginPage, req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Role-guarded settings pages（类 A）：仅 VERIFIED_USER/ADMIN 可访问 ──────
  // settings/ai 与 settings/ima 的页面内 role guard 在渲染体调 router.push，
  // SSR 抛 `location is not defined`（dev server uncaughtException）。改由 middleware
  // 在请求层拦截：已登录但非 verified 用户 → 302 到 /settings，页面不渲染。
  const VERIFIED_ONLY_SETTINGS = ["/settings/ai", "/settings/ima"];
  if (
    VERIFIED_ONLY_SETTINGS.some((p) => pathname === p) &&
    authenticatedUser.role !== "ADMIN" &&
    authenticatedUser.role !== "VERIFIED_USER"
  ) {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except _next/static, _next/image, favicon.ico
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
