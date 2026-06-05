import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { FileText, Home, Layers, CreditCard, Search, RotateCcw, Compass, Sparkles } from "lucide-react";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { validateSession, type AuthUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "申论素材采集台",
  description: "采集官方文章，生成 AI 素材卡，同步至 ima 知识库",
};

const navItems = [
  { href: "/", label: "仪表板", icon: Home },
  { href: "/discover", label: "今日推荐", icon: Sparkles },
  { href: "/explore", label: "探索区", icon: Compass },
  { href: "/articles", label: "文章列表", icon: FileText },
  { href: "/cards", label: "素材卡", icon: CreditCard },
  { href: "/search", label: "检索", icon: Search },
  { href: "/review", label: "复习", icon: RotateCcw },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read current user from session cookie
  let currentUser: AuthUser | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      currentUser = await validateSession(token);
    }
  } catch {
    // cookies() may throw in edge cases; treat as unauthenticated
  }

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Toaster position="top-right" richColors />
        {/* Top navigation */}
        <header className="border-b bg-card">
          <div className="flex h-12 items-center px-6 gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
              <Layers className="h-5 w-5 text-primary" />
              申论素材采集台
            </Link>
            <nav className="flex items-center gap-1 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            {/* User status area */}
            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {currentUser.username}
                  </span>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      退出
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/admin/login"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
