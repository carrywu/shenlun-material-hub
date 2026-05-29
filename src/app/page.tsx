import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  Search,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CollectButton } from "@/components/CollectButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
    db.contentItem.count(),
    db.materialCard.count(),
    db.materialCard.count({ where: { confirmed: false } }),
    db.materialCard.count({ where: { confirmed: true } }),
    db.source.count(),
    db.source.count({ where: { verificationStatus: "verified" } }),
    db.contentItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        source: { select: { name: true } },
        _count: { select: { materialCards: true } },
      },
    }),
    db.materialCard.groupBy({
      by: ["cardType"],
      _count: { id: true },
    }),
  ]);

  const cardTypeCounts = Object.fromEntries(
    cardsByType.map((r) => [r.cardType, r._count.id])
  );

  const stats = [
    { label: "内容条目", value: totalItems, icon: FileText, color: "text-blue-600" },
    { label: "素材卡", value: totalCards, icon: CheckCircle, color: "text-green-600" },
    { label: "待确认", value: unconfirmedCards, icon: Clock, color: "text-amber-600" },
    { label: "已确认", value: confirmedCards, icon: CheckCircle, color: "text-emerald-600" },
    { label: "来源", value: `${verifiedSources}/${totalSources}`, icon: BookOpen, color: "text-purple-600" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">申论素材采集台</h1>
            <p className="text-sm text-muted-foreground">
              采集官方内容，生成 AI 素材卡，同步至 ima 知识库
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CollectButton />
            <Link href="/articles" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Plus className="mr-1.5 h-4 w-4" />
              浏览内容
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent content items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">最近采集的内容</CardTitle>
            <Link
              href="/articles"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              查看全部
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p>暂无内容</p>
                <p className="text-sm">点击「浏览内容」开始</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {item.source?.name ?? item.platform}
                        </Badge>
                        <span>{item.contentType}</span>
                        {item.publishedAt && (
                          <span>
                            {new Date(item.publishedAt).toLocaleDateString(
                              "zh-CN"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground shrink-0 ml-4">
                      {item._count.materialCards} 张素材卡
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card type breakdown */}
        {totalCards > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">素材卡类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { key: "fact_summary", label: "事实摘要", color: "bg-blue-500" },
                  { key: "argument_analysis", label: "论点分析", color: "bg-purple-500" },
                  { key: "data_highlight", label: "数据亮点", color: "bg-green-500" },
                  { key: "policy_compare", label: "政策对比", color: "bg-orange-500" },
                  { key: "case_study", label: "案例研究", color: "bg-teal-500" },
                ].map((t) => (
                  <div key={t.key} className="text-center">
                    <div className={`h-2 rounded-full ${t.color} mb-2`} />
                    <p className="text-lg font-bold">{cardTypeCounts[t.key] ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { href: "/discover", label: "今日推荐", desc: "已核验来源内容", color: "bg-blue-100 text-blue-600", icon: FileText },
            { href: "/explore", label: "探索区", desc: "待核验内容", color: "bg-cyan-100 text-cyan-600", icon: Search },
            { href: "/articles", label: "文章库", desc: "精选内容", color: "bg-indigo-100 text-indigo-600", icon: BookOpen },
            { href: "/cards", label: "素材卡", desc: "编辑同步", color: "bg-purple-100 text-purple-600", icon: CheckCircle },
            { href: "/subscriptions", label: "来源管理", desc: "采集来源", color: "bg-green-100 text-green-600", icon: Plus },
            { href: "/sync-records", label: "同步记录", desc: "同步历史", color: "bg-amber-100 text-amber-600", icon: ArrowRight },
            { href: "/review", label: "复习", desc: "记忆检验", color: "bg-rose-100 text-rose-600", icon: RotateCcw },
          ].map((item) => (
            <Card key={item.href} className="hover:border-primary/50 transition-colors cursor-pointer">
              <Link href={item.href}>
                <CardContent className="flex flex-col items-center gap-2 pt-5 pb-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
