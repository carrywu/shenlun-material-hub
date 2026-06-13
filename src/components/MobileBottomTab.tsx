"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, CreditCard, RotateCcw, Settings, Home } from "lucide-react";
import type { AuthUser } from "@/lib/auth";

interface MobileBottomTabProps {
  currentUser: AuthUser | null;
}

export function MobileBottomTab({ currentUser }: MobileBottomTabProps) {
  const pathname = usePathname();

  // Don't show on login pages or admin pages
  if (
    !currentUser ||
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  const role = currentUser.role;

  // Role-based tab items
  const tabs = [
    { href: "/", label: "首页", icon: Home },
    { href: "/articles", label: "文章", icon: FileText },
    ...(role === "VERIFIED_USER" || role === "ADMIN"
      ? [{ href: "/cards", label: "素材卡", icon: CreditCard }]
      : []),
    { href: "/review", label: "复习", icon: RotateCcw },
    { href: "/settings", label: "设置", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
