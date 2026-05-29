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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalArticles, totalCards, unconfirmedCards, recentArticles, totalReviews, recentReviews] =
    await Promise.all([
      db.article.count(),
      db.materialCard.count(),
      db.materialCard.count({ where: { confirmed: false } }),
      db.article.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { materialCards: true } } },
      }),
      db.reviewRecord.count(),
      db.reviewRecord.findMany({
        orderBy: { reviewedAt: "desc" },
        take: 5,
        include: {
          materialCard: {
            select: { id: true, title: true, category: true },
          },
        },
      }),
    ]);

  const confirmedCards = totalCards - unconfirmedCards;

  const stats = [
    {
      label: "总文章数",
      value: totalArticles,
      icon: FileText,
      color: "text-blue-600",
    },
    {
      label: "素材卡总数",
      value: totalCards,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      label: "待确认",
      value: unconfirmedCards,
      icon: Clock,
      color: "text-amber-600",
    },
    {
      label: "已确认",
      value: confirmedCards,
      icon: CheckCircle,
      color: "text-emerald-600",
    },
    {
      label: "复习次数",
      value: totalReviews,
      icon: RotateCcw,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">申论素材采集台</h1>
            <p className="text-sm text-muted-foreground">
              采集官方文章，生成 AI 素材卡，同步至 ima 知识库
            </p>
          </div>
          <Link href="/articles" className={cn(buttonVariants())}>
            <Plus className="mr-1.5 h-4 w-4" />
            采集文章
          </Link>
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

        {/* Recent articles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">最近采集的文章</CardTitle>
            <Link
              href="/articles"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              查看全部
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p>暂无文章</p>
                <p className="text-sm">点击「采集文章」开始</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {article.source}
                        </Badge>
                        <span>{article.category}</span>
                        {article.publishedAt && (
                          <span>
                            {new Date(article.publishedAt).toLocaleDateString(
                              "zh-CN"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground shrink-0 ml-4">
                      {article._count.materialCards} 张素材卡
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent reviews */}
        {recentReviews.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">最近复习记录</CardTitle>
              <Link
                href="/review"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                继续复习
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/cards/${review.materialCard.id}`}
                        className="font-medium truncate hover:underline block"
                      >
                        {review.materialCard.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {review.materialCard.category}
                        </Badge>
                        <span>
                          {new Date(review.reviewedAt).toLocaleDateString(
                            "zh-CN"
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {[1, 2, 3, 4, 5].map((q) => (
                        <span
                          key={q}
                          className={`text-xs ${q <= review.quality ? "text-amber-500" : "text-muted-foreground/30"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <Link href="/articles">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">浏览文章</p>
                  <p className="text-sm text-muted-foreground">
                    查看和筛选已采集的文章
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">采集新文章</p>
                <p className="text-sm text-muted-foreground">
                  从 URL 采集官方文章
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <Link href="/cards">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">素材卡管理</p>
                  <p className="text-sm text-muted-foreground">
                    编辑和同步素材卡
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <Link href="/search">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">检索素材卡</p>
                  <p className="text-sm text-muted-foreground">
                    全文搜索素材卡内容
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <Link href="/review">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">复习模式</p>
                  <p className="text-sm text-muted-foreground">
                    逐步揭示内容复习
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
