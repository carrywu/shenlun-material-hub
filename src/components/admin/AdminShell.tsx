"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutPanelLeft,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ADMIN_NAVIGATION_GROUPS,
  findActiveAdminNavigationItem,
  isAdminNavigationItemActive,
} from "@/components/admin/admin-navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function AdminNavigation({
  collapsed = false,
  onNavigate,
  pathname,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <Tooltip.Provider>
      <nav aria-label="后台主导航" className="flex-1 overflow-y-auto px-3 py-4">
        {ADMIN_NAVIGATION_GROUPS.map((group, groupIndex) => (
          <section
            key={group.label}
            aria-labelledby={`admin-nav-group-${groupIndex}`}
            className={cn(groupIndex > 0 && "mt-5")}
          >
            <h2
              id={`admin-nav-group-${groupIndex}`}
              className={cn(
                "mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                collapsed && "sr-only"
              )}
            >
              {group.label}
            </h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isAdminNavigationItemActive(pathname, item.href);
                const linkClassName = cn(
                  "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-0"
                );
                const link = (
                  <Link
                    href={item.href}
                    aria-label={collapsed ? item.name : undefined}
                    aria-current={active ? "page" : undefined}
                    className={linkClassName}
                    onClick={onNavigate}
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.name}</span>}
                    {active && <span className="sr-only">（当前页面）</span>}
                  </Link>
                );

                if (!collapsed) return <div key={item.href}>{link}</div>;

                return (
                  <Tooltip.Root key={item.href}>
                    <Tooltip.Trigger render={link} delay={250} />
                    <Tooltip.Portal>
                      <Tooltip.Positioner side="right" sideOffset={8} className="z-[80]">
                        <Tooltip.Popup className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md">
                          {item.name}
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </Tooltip.Provider>
  );
}

function AdminSidebarFooter({
  adminUser,
  collapsed = false,
  loggingOut,
  onLogout,
}: {
  adminUser: string;
  collapsed?: boolean;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  return (
    <div className="space-y-2 border-t border-border p-3">
      <Link
        href="/"
        aria-label="返回前台学习区"
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
          collapsed && "justify-center px-0"
        )}
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span>返回前台学习区</span>}
      </Link>

      <div className={cn("flex items-center gap-2 rounded-lg bg-muted/70 p-2", collapsed && "flex-col")}>
        <Link
          href="/settings/account"
          aria-label={`${adminUser} 账户设置`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">{adminUser}</span>
              <span className="block text-[10px] text-muted-foreground">管理员账户</span>
            </span>
          )}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="退出登录"
          title="退出登录"
          onClick={onLogout}
          disabled={loggingOut}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
        </Button>
      </div>
    </div>
  );
}

function AdminBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/admin"
      aria-label="申论素材后台首页"
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        collapsed && "justify-center"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">申论素材后台</span>
          <span className="block text-[10px] text-muted-foreground">管理控制台</span>
        </span>
      )}
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState("管理员");
  const [authorized, setAuthorized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileDialog, setMobileDialog] = useState({ open: false, pathname });
  const mobileOpen = mobileDialog.open && mobileDialog.pathname === pathname;
  const setMobileOpen = (open: boolean) => setMobileDialog({ open, pathname });

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/check");
        if (!response.ok) throw new Error("Unauthenticated");

        const data = await response.json();
        if (cancelled) return;
        if (data.role !== "ADMIN") {
          router.push("/");
          return;
        }
        if (data.username) setAdminUser(data.username);
        setAuthorized(true);
      } catch {
        if (!cancelled) router.push("/admin/login");
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
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (!authorized) {
    return (
      <div className="admin-shell-theme flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="正在验证管理员身份" />
      </div>
    );
  }

  const activeItem = findActiveAdminNavigationItem(pathname);

  return (
    <div className="admin-shell-theme flex min-h-dvh overflow-hidden bg-background text-foreground">
      <aside
        data-testid="admin-sidebar"
        data-state={collapsed ? "collapsed" : "expanded"}
        className={cn(
          "hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-[16.5rem]"
        )}
      >
        <div className={cn("flex h-[4.5rem] shrink-0 items-center border-b border-border px-4", collapsed && "justify-center px-2")}>
          <AdminBrand collapsed={collapsed} />
        </div>
        <AdminNavigation collapsed={collapsed} pathname={pathname} />
        <AdminSidebarFooter
          adminUser={adminUser}
          collapsed={collapsed}
          loggingOut={loggingOut}
          onLogout={handleLogout}
        />
      </aside>

      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6 lg:px-8">
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid="admin-mobile-menu-trigger"
                  aria-label="打开后台导航"
                  className="lg:hidden"
                />
              }
            >
              <Menu />
            </DialogTrigger>
            <DialogContent
              showCloseButton={false}
              data-testid="admin-mobile-drawer"
              className="inset-y-0 left-0 top-0 h-dvh w-[min(20rem,calc(100%-2rem))] max-w-none -translate-x-0 -translate-y-0 gap-0 rounded-none border-r border-border bg-card p-0 ring-0 sm:max-w-none lg:hidden"
            >
              <DialogTitle className="sr-only">后台导航</DialogTitle>
              <DialogDescription className="sr-only">选择管理页面或账户操作</DialogDescription>
              <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-border px-4">
                <AdminBrand />
                <DialogClose
                  render={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭后台导航" />
                  }
                >
                  <X />
                </DialogClose>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
                <AdminNavigation pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                <AdminSidebarFooter
                  adminUser={adminUser}
                  loggingOut={loggingOut}
                  onLogout={handleLogout}
                />
              </div>
            </DialogContent>
          </Dialog>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">管理控制台</p>
            <h1 data-testid="admin-shell-heading" className="truncate text-base font-semibold tracking-tight">
              {activeItem?.name ?? "控制台"}
            </h1>
          </div>

          <Button
            data-testid="admin-sidebar-toggle"
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            aria-expanded={!collapsed}
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
          <LayoutPanelLeft className="hidden size-4 text-muted-foreground lg:block" aria-hidden="true" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
