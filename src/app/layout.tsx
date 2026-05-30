import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FileText, Home, Layers, CreditCard, Search, RotateCcw, Rss, Compass, Sparkles, History, Trash2, Settings } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  { href: "/subscriptions", label: "来源管理", icon: Rss },
  { href: "/search", label: "检索", icon: Search },
  { href: "/review", label: "复习", icon: RotateCcw },
  { href: "/sync-records", label: "同步记录", icon: History },
  { href: "/admin/clean", label: "数据清洗", icon: Trash2 },
  { href: "/settings/ai", label: "AI 配置", icon: Settings },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Top navigation */}
        <header className="border-b bg-card">
          <div className="flex h-12 items-center px-6 gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
              <Layers className="h-5 w-5 text-primary" />
              申论素材采集台
            </Link>
            <nav className="flex items-center gap-1">
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
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
