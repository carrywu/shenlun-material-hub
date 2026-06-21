"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getFrontendNavigation,
  isNavigationItemActive,
} from "@/components/navigation/navigation-config";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function MobileBottomTab({ currentUser }: { currentUser: AuthUser | null }) {
  const pathname = usePathname();

  if (!currentUser) return null;

  const tabs = getFrontendNavigation(currentUser.role).filter(
    (item) => item.href !== "/search"
  );

  return (
    <nav
      aria-label="移动端主导航"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const active = isNavigationItemActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
              )}
              <tab.icon className="size-5" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
