"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/navigation/AccountMenu";
import {
  getFrontendNavigation,
  isNavigationItemActive,
} from "@/components/navigation/navigation-config";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function RootNav({ currentUser }: { currentUser: AuthUser | null }) {
  const pathname = usePathname();
  const role = currentUser?.role ?? "USER";
  const navItems = getFrontendNavigation(role);

  return (
    <header data-testid="root-nav" className="hidden h-[4.5rem] shrink-0 border-b border-border/80 bg-card md:block">
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-5 lg:gap-8 lg:px-8">
        <Link
          href="/"
          aria-label="申论素材"
          className="flex shrink-0 items-center rounded-lg text-lg font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          申论素材
        </Link>

        <nav aria-label="主导航" className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {navItems.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 lg:min-w-[5.5rem] lg:px-3",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
                {active && <span className="sr-only">（当前页面）</span>}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-end">
          {currentUser ? (
            <AccountMenu user={currentUser} />
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
