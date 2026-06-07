import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  Search,
  RotateCcw,
  BookOpen,
  TrendingUp,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CollectButton } from "@/components/CollectButton";
import { CONTENT_TYPE_LABELS } from "@/lib/display-labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Server-side auth check — redirect unauthenticated users
  let currentUser = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      currentUser = await validateSession(token);
    }
  } catch {
    // ignore
  }

  if (!currentUser) {
    redirect("/admin/login?redirect=/");
  }

  const isAdmin = currentUser.role === "ADMIN";

  // Data isolation: non-admin users only see their own data for owned models
  // Source is a shared/global entity — no ownerUserId field
  const ownerFilter = isAdmin ? {} : { ownerUserId: currentUser.id };

  const [
    totalItems,
    totalCards,
    unconfirmedCards,
    confirmedCards,
    totalSources,
    verifiedSources,
    recentItems,
    cardsByType,
  ] = await Promise.all([
    db.contentItem.count({ where: ownerFilter }),
    db.materialCard.count({ where: ownerFilter }),
    db.materialCard.count({ where: { ...ownerFilter, confirmed: false } }),
    db.materialCard.count({ where: { ...ownerFilter, confirmed: true } }),
    db.source.count(),
    db.source.count({ where: { verificationStatus: "verified" } }),
    db.contentItem.findMany({
      where: ownerFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        source: { select: { name: true } },
        _count: { select: { materialCards: true } },
      },
    }),
    db.materialCard.groupBy({
      by: ["cardType"],
      where: ownerFilter,
      _count: { id: true },
    }),
  ]);

  const cardTypeCounts = Object.fromEntries(
    cardsByType.map((r) => [r.cardType, r._count.id])
  );

  const stats = [
    {
      label: "内容条目",
      value: totalItems,
      icon: FileText,
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600 dark:text-blue-400",
      desc: "已采集内容",
    },
    {
      label: "素材卡",
      value: totalCards,
      icon: Layers,
      gradient: "from-violet-500 to-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      text: "text-violet-600 dark:text-violet-400",
      desc: "AI 生成卡片",
    },
    {
      label: "待确认",
      value: unconfirmedCards,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600 dark:text-amber-400",
      desc: "待人工审核",
    },
    {
      label: "已确认",
      value: confirmedCards,
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-green-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600 dark:text-emerald-400",
      desc: "可同步至 IMA",
    },
    {
      label: "核验来源",
      value: `${verifiedSources}/${totalSources}`,
      icon: TrendingUp,
      gradient: "from-pink-500 to-rose-500",
      bg: "bg-pink-50 dark:bg-pink-950/30",
      text: "text-pink-600 dark:text-pink-400",
      desc: "已核验来源",
    },
  ];

  const cardTypeConfig = [
    { key: "golden_sentence", label: "申论金句", color: "bg-yellow-500", light: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
    { key: "standard_expression", label: "规范词", color: "bg-blue-500", light: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    { key: "case_material", label: "案例素材", color: "bg-teal-500", light: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
    { key: "countermeasure", label: "对策表达", color: "bg-green-500", light: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
    { key: "problem_statement", label: "问题表述", color: "bg-red-500", light: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
    { key: "reason_analysis", label: "原因分析", color: "bg-violet-500", light: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
    { key: "policy_expression", label: "政策表述", color: "bg-orange-500", light: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
    { key: "person_story", label: "人物事迹", color: "bg-pink-500", light: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
    { key: "article_structure", label: "文章框架", color: "bg-indigo-500", light: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  ];

  const quickActions = [
    { href: "/discover", label: "今日推荐", desc: "已核验来源", icon: Sparkles, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60" },
    { href: "/explore", label: "探索区", desc: "待核验内容", icon: Search, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-950/60" },
    { href: "/articles", label: "文章库", desc: "精选内容", icon: BookOpen, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60" },
    { href: "/cards", label: "素材卡", desc: "编辑同步", icon: Layers, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-950/60" },
    { href: "/review", label: "复习", desc: "记忆检验", icon: RotateCcw, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Hero Header */}
      <div className="relative border-b bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.1),transparent_60%)]" />
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm border border-white/10">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  申论备考助手
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">申论素材采集台</h1>
              <p className="text-sm text-slate-400 mt-1">
                采集官方内容 · AI 生成素材卡 · 一键同步至 IMA 知识库
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CollectButton />
              <Link
                href="/articles"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
                )}
              >
                <BookOpen className="mr-1.5 h-4 w-4" />
                浏览内容
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-xl p-4 border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                stat.bg
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.text)} />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", stat.text)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent items */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">最近采集的内容</CardTitle>
                <Link
                  href="/articles"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs h-7")}
                >
                  查看全部
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                {recentItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <FileText className="h-6 w-6 opacity-50" />
                    </div>
                    <p className="font-medium">暂无内容</p>
                    <p className="text-sm mt-1">点击「浏览内容」开始采集</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`/articles/${item.id}`}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-all duration-150 hover:border-primary/20 group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                              {item.source?.name ?? item.platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType}</span>
                            {item.publishedAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.publishedAt).toLocaleDateString("zh-CN")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 ml-3 flex items-center gap-1.5">
                          {item._count.materialCards > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {item._count.materialCards} 卡
                            </Badge>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Card type breakdown */}
          <div className="space-y-4">
            {totalCards > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">素材卡类型分布</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {cardTypeConfig.map((t) => {
                    const count = cardTypeCounts[t.key] ?? 0;
                    const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
                    return (
                      <div key={t.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", t.light)}>
                            {t.label}
                          </span>
                          <span className="text-xs font-bold tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", t.color)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">快捷入口</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {quickActions.slice(0, 6).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg p-2.5 transition-all duration-150",
                      item.bg
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", item.color)} />
                    <p className="text-xs font-medium">{item.label}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
