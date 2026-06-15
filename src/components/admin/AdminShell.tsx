"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookText,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FolderTree,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  LucideIcon,
  Loader2,
  Menu,
  Rss,
  Settings,
  Terminal,
  Ticket,
  User,
  Shield,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface SidebarItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navItems: SidebarItem[] = [
  { name: "系统概览", href: "/admin", icon: LayoutDashboard },
  { name: "文章管理", href: "/admin/articles", icon: BookText },
  { name: "来源管理", href: "/admin/sources", icon: FolderTree },
  { name: "微信集成", href: "/admin/integrations/wewe-rss", icon: Rss },
  { name: "同步记录", href: "/admin/sync-records", icon: History },
  { name: "异步任务", href: "/admin/tasks", icon: ListTodo },
  { name: "系统日志", href: "/admin/logs", icon: Terminal },
  { name: "AI 配置", href: "/admin/settings/ai", icon: Settings },
  { name: "数据备份", href: "/admin/backup", icon: Database },
  { name: "数据清洗", href: "/admin/clean", icon: Terminal },
  { name: "邀请码管理", href: "/admin/invitations", icon: Ticket },
  { name: "用户管理", href: "/admin/users", icon: User },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState("管理员");
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const { isAdmin } = useAuth();

  // Only ADMIN can access admin backend — show full nav
  const visibleNavItems = navItems;

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/check");
        if (!res.ok) {
          throw new Error("Unauthenticated");
        }

        const data = await res.json();
        if (!cancelled && data.username) {
          setAdminUser(data.username);
          // Non-admin users must not access admin backend
          if (data.role !== "ADMIN") {
            router.push("/");
            return;
          }
          setAuthorized(true);
        }
      } catch {
        if (!cancelled) {
          router.push("/admin/login");
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  }

  // Block rendering until role check confirms ADMIN
  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-30 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu />
      </Button>

      <aside className={`flex h-full flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-200
        ${collapsed ? "w-16" : "w-64"}
        ${mobileOpen ? "fixed inset-y-0 left-0 z-50 w-64" : "hidden lg:flex"}
      `}>
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          {!collapsed && (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">申论素材后台</h2>
                <span className="text-[10px] text-muted-foreground">管理控制台</span>
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:block"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(false)}
              title="关闭菜单"
            >
              <X />
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border bg-card p-4">
          <Link
            href="/"
            className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>返回前台学习区</span>
            </div>
          </Link>

          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="max-w-[100px] truncate text-xs font-medium text-foreground">{adminUser}</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                  {isAdmin && <Shield className="h-2.5 w-2.5" />}
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                  在线
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="hover:bg-red-50 hover:text-red-600"
              title="退出登录"
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-card px-8">
          <h1 className="text-sm font-semibold tracking-wide text-foreground">
            {visibleNavItems.find((item) => item.href === pathname || (item.href !== "/admin" && pathname.startsWith(item.href)))?.name || "控制台"}
          </h1>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>系统状态: <strong className="font-medium text-emerald-600">正常运行</strong></span>
            <span className="h-3 w-px bg-border"></span>
            <span>当前时间: {new Date().toLocaleDateString("zh-CN")}</span>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto bg-muted/50 p-8">{children}</div>
      </main>
    </div>
  );
}
