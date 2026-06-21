"use client";

import { Menu } from "@base-ui/react/menu";
import {
  Bot,
  ChevronDown,
  ExternalLink,
  LogOut,
  Settings,
  Shield,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const roleLabels: Record<AuthUser["role"], string> = {
  ADMIN: "管理员",
  VERIFIED_USER: "认证用户",
  USER: "普通用户",
};

const itemClassName =
  "flex min-h-9 cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-popover-foreground outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

export function AccountMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const canUsePersonalIntegrations =
    user.role === "VERIFIED_USER" || user.role === "ADMIN";
  const initial = user.username.trim().slice(0, 1).toUpperCase() || "用";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${user.username} 账户菜单`}
        className="flex h-10 max-w-44 items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 data-[popup-open]:bg-accent"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
          {initial}
        </span>
        <span className="hidden max-w-24 truncate lg:inline">{user.username}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-[70]">
          <Menu.Popup className="w-60 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold">{user.username}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{roleLabels[user.role]}</p>
            </div>
            <div className="my-1 h-px bg-border" />

            <Menu.LinkItem href="/settings/account" closeOnClick className={itemClassName}>
              <Settings className="size-4" aria-hidden="true" />
              账号设置
            </Menu.LinkItem>
            {canUsePersonalIntegrations && (
              <>
                <Menu.LinkItem href="/settings/ai" closeOnClick className={itemClassName}>
                  <Bot className="size-4" aria-hidden="true" />
                  AI 设置
                </Menu.LinkItem>
                <Menu.LinkItem href="/settings/ima" closeOnClick className={itemClassName}>
                  <UploadCloud className="size-4" aria-hidden="true" />
                  IMA 设置
                </Menu.LinkItem>
              </>
            )}
            {user.role === "ADMIN" && (
              <Menu.LinkItem href="/admin" closeOnClick className={itemClassName}>
                <Shield className="size-4" aria-hidden="true" />
                管理后台
                <ExternalLink className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
              </Menu.LinkItem>
            )}

            <div className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={handleLogout}
              className={cn(itemClassName, "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive")}
            >
              <LogOut className="size-4" aria-hidden="true" />
              退出登录
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
