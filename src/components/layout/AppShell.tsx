"use client";

import { usePathname } from "next/navigation";

import { MobileBottomTab } from "@/components/MobileBottomTab";
import RootNav from "@/components/RootNav";
import { classifyShellRoute } from "@/components/navigation/navigation-config";
import type { AuthUser } from "@/lib/auth";

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: AuthUser | null;
}) {
  const pathname = usePathname();
  const shell = classifyShellRoute(pathname);

  if (shell !== "frontend") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col" data-shell="frontend">
      <RootNav currentUser={currentUser} />
      <main
        data-testid="frontend-shell-main"
        className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>
      <MobileBottomTab currentUser={currentUser} />
    </div>
  );
}
