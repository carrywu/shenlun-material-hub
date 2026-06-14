"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText, Home, CreditCard, Search,
  RotateCcw, Shield, Settings,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/auth";

// Base nav items for all logged-in users
const baseNavItems = [
  { href: "/articles", label: "文章", icon: FileText },
];

// Tail nav items (always shown, after verified items)
const tailNavItems = [
  { href: "/settings", label: "设置", icon: Settings },
];

// Extra items for VERIFIED_USER and ADMIN
const verifiedNavItems = [
  { href: "/cards", label: "素材卡", icon: CreditCard },
  { href: "/search", label: "检索", icon: Search },
];

const reviewNavItem = { href: "/review", label: "复习", icon: RotateCcw };

const roleLabels: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "管理员", color: "bg-violet-100 text-violet-700" },
  VERIFIED_USER: { label: "认证用户", color: "bg-blue-100 text-blue-700" },
  USER: { label: "普通用户", color: "bg-gray-100 text-gray-600" },
};

export default function RootNav({ currentUser }: { currentUser: AuthUser | null }) {
  const pathname = usePathname();
  const router = useRouter();

  // Hide navigation on login pages
  if (pathname === "/admin/login" || pathname === "/login") {
    return null;
  }

  const role = currentUser?.role ?? "USER";
  const navItems = [
    { href: "/", label: "首页", icon: Home },
    ...baseNavItems,
    ...(role === "VERIFIED_USER" || role === "ADMIN" ? verifiedNavItems : []),
    reviewNavItem,
    ...tailNavItems,
  ];

  const isAdmin = currentUser?.role === "ADMIN";
  const roleInfo = currentUser ? roleLabels[currentUser.role] ?? roleLabels.USER : null;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors — cookie will be cleared by the API
    }
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b bg-card">
      <div className="flex h-12 items-center px-4 md:px-6 gap-3 md:gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sm shrink-0">
          <Layers className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">申论素材采集台</span>
        </Link>
        {/* 移动端：nav 可横向滚动，不撑破 header；仅图标+sm 起显示文字 */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 rounded-md px-2.5 md:px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
        {/* User status area */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              {roleInfo && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" />
                  管理后台
                </Link>
              )}
              <span className="text-xs text-muted-foreground">
                {currentUser.username}
              </span>
              <Button
                variant="link"
                size="xs"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                退出
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
