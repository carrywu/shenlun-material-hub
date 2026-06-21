import {
  CreditCard,
  FileText,
  Home,
  RotateCcw,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/auth";

export type ShellRouteKind = "auth" | "admin" | "frontend";

export interface FrontendNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const AUTH_ROUTES = new Set(["/login", "/register", "/admin/login"]);

const FRONTEND_NAVIGATION: Record<UserRole, FrontendNavigationItem[]> = {
  USER: [
    { href: "/", label: "首页", icon: Home },
    { href: "/articles", label: "文章", icon: FileText },
    { href: "/review", label: "复习", icon: RotateCcw },
    { href: "/settings", label: "设置", icon: Settings },
  ],
  VERIFIED_USER: [
    { href: "/", label: "首页", icon: Home },
    { href: "/articles", label: "文章", icon: FileText },
    { href: "/cards", label: "素材卡", icon: CreditCard },
    { href: "/search", label: "检索", icon: Search },
    { href: "/review", label: "复习", icon: RotateCcw },
    { href: "/settings", label: "设置", icon: Settings },
  ],
  ADMIN: [
    { href: "/", label: "首页", icon: Home },
    { href: "/articles", label: "文章", icon: FileText },
    { href: "/cards", label: "素材卡", icon: CreditCard },
    { href: "/search", label: "检索", icon: Search },
    { href: "/review", label: "复习", icon: RotateCcw },
    { href: "/settings", label: "设置", icon: Settings },
  ],
};

export function classifyShellRoute(pathname: string): ShellRouteKind {
  if (AUTH_ROUTES.has(pathname)) return "auth";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return "frontend";
}

export function getFrontendNavigation(
  role: UserRole
): FrontendNavigationItem[] {
  return FRONTEND_NAVIGATION[role];
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
