"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Bookmark,
  CreditCard,
  CheckCircle,
  ExternalLink,
  Shield,
} from "lucide-react";
import {
  CONTENT_TYPES,
  PLATFORMS,
  TRUST_LEVELS,
} from "@/types";

interface DiscoverItem {
  id: string;
  title: string;
  originalUrl: string;
  platform: string;
  contentType: string;
  trustLevel: string;
  excerpt: string | null;
  publishedAt: string | null;
  topicTags: string;
  source: {
    id: string;
    name: string;
    platform: string;
    trustLevel: string;
    verificationStatus: string;
  };
  _count: { materialCards: number };
}

interface DiscoverResponse {
  data: DiscoverItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TRUST_LEVEL_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"; className: string }
> = {
  official_primary: {
    label: "核心官方",
    variant: "default",
    className: "bg-green-600 text-white hover:bg-green-700",
  },
  official_repost: {
    label: "官方转载",
    variant: "default",
    className: "bg-blue-600 text-white hover:bg-blue-700",
  },
  verified_media: {
    label: "认证媒体",
    variant: "default",
    className: "bg-cyan-600 text-white hover:bg-cyan-700",
  },
  expert_opinion: {
    label: "专家观点",
    variant: "default",
    className: "bg-orange-500 text-white hover:bg-orange-600",
  },
  unverified: {
    label: "未验证",
    variant: "outline",
    className: "text-muted-foreground",
  },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  policy_analysis: "政策解读",
  social_issue: "社会问题",
  economic_trend: "经济趋势",
  cultural_heritage: "文化传承",
  ecological_protection: "生态保护",
  legal_regulation: "法治法规",
  tech_innovation: "科技创新",
  education_reform: "教育改革",
  livelihood_welfare: "民生福祉",
  international_affairs: "国际事务",
};

const PLATFORM_LABELS: Record<string, string> = {
  website: "网站",
  wechat: "微信",
  bilibili: "B站",
  xiaohongshu: "小红书",
};

export default function DiscoverPage() {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [platform, setPlatform] = useState("all");
  const [contentType, setContentType] = useState("all");
  const [trustLevel, setTrustLevel] = useState("all");

  // Actions state
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [markedRead, setMarkedRead] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);

  const pageSize = 20;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (platform !== "all") params.set("platform", platform);
      if (contentType !== "all") params.set("contentType", contentType);
      if (trustLevel !== "all") params.set("trustLevel", trustLevel);

      const res = await fetch(`/api/discover?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: DiscoverResponse = await res.json();
      setItems(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, platform, contentType, trustLevel]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [platform, contentType, trustLevel]);

  function toggleBookmark(id: string) {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMarkRead(id: string) {
    setMarkedRead((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateCard(item: DiscoverItem) {
    if (generating) return;
    setGenerating(item.id);
    try {
      const res = await fetch(`/api/content-items/${item.id}/generate-card`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = data.error ?? "生成失败";
        if (data.code === "AI_CONFIG_MISSING" || data.code === "AI_CONFIG_DECRYPT_FAILED") {
          msg += "\n请前往 设置 > AI 配置 进行配置";
        }
        throw new Error(msg);
      }
      // Update card count locally
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, _count: { materialCards: i._count.materialCards + 1 } }
            : i
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成素材卡失败");
    } finally {
      setGenerating(null);
    }
  }

  // Group items by source
  const groupedBySource = items.reduce(
    (acc, item) => {
      const sourceName = item.source.name;
      if (!acc[sourceName]) {
        acc[sourceName] = {
          source: item.source,
          items: [],
        };
      }
      acc[sourceName].items.push(item);
      return acc;
    },
    {} as Record<
      string,
      { source: DiscoverItem["source"]; items: DiscoverItem[] }
    >
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">今日推荐</h1>
            <p className="text-sm text-muted-foreground">
              已核验来源的最新内容，共 {total} 条
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Select value={platform} onValueChange={(v) => { if (v) setPlatform(v); }}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue>
                {platform === "all" ? "全部平台" : (PLATFORM_LABELS[platform] ?? platform)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLATFORM_LABELS[p] ?? p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={contentType} onValueChange={(v) => { if (v) setContentType(v); }}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue>
                {contentType === "all" ? "全部类型" : (CONTENT_TYPE_LABELS[contentType] ?? contentType)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={trustLevel} onValueChange={(v) => { if (v) setTrustLevel(v); }}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue>
                {trustLevel === "all" ? "全部等级" : (TRUST_LEVEL_CONFIG[trustLevel]?.label ?? trustLevel)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部等级</SelectItem>
              {TRUST_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {TRUST_LEVEL_CONFIG[l]?.label ?? l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error ? (
          <div className="flex items-center justify-center h-48 text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Shield className="h-8 w-8" />
            <p>暂无已核验内容</p>
            <p className="text-sm">请先核验来源或调整筛选条件</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedBySource).map(
              ([sourceName, { source, items: sourceItems }]) => {
                const trustConfig =
                  TRUST_LEVEL_CONFIG[source.trustLevel] ??
                  TRUST_LEVEL_CONFIG.unverified;
                return (
                  <div key={sourceName}>
                    {/* Source header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-sm font-semibold">{sourceName}</h2>
                      <Badge
                        variant={trustConfig.variant}
                        className={`text-[10px] ${trustConfig.className}`}
                      >
                        {trustConfig.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {PLATFORM_LABELS[source.platform] ?? source.platform}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {sourceItems.length} 条内容
                      </span>
                    </div>

                    {/* Content cards */}
                    <div className="grid gap-3">
                      {sourceItems.map((item) => {
                        const itemTrust =
                          TRUST_LEVEL_CONFIG[item.trustLevel] ??
                          TRUST_LEVEL_CONFIG.unverified;
                        return (
                          <div
                            key={item.id}
                            className={`border rounded-lg p-4 transition-colors ${
                              markedRead.has(item.id)
                                ? "bg-muted/50 opacity-60"
                                : "bg-card hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <a
                                    href={item.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-sm hover:underline flex items-center gap-1"
                                  >
                                    {item.title}
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                  </a>
                                </div>

                                {item.excerpt && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                    {item.excerpt}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 mt-2">
                                  <Badge
                                    variant={itemTrust.variant}
                                    className={`text-[10px] ${itemTrust.className}`}
                                  >
                                    {itemTrust.label}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {CONTENT_TYPE_LABELS[item.contentType] ??
                                      item.contentType}
                                  </Badge>
                                  {item.publishedAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(
                                        item.publishedAt
                                      ).toLocaleDateString("zh-CN")}
                                    </span>
                                  )}
                                  {item._count.materialCards > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {item._count.materialCards} 张素材卡
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant={
                                    bookmarked.has(item.id)
                                      ? "default"
                                      : "ghost"
                                  }
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => toggleBookmark(item.id)}
                                  title="收藏"
                                >
                                  <Bookmark
                                    className={`h-3.5 w-3.5 ${
                                      bookmarked.has(item.id)
                                        ? "fill-current"
                                        : ""
                                    }`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleGenerateCard(item)}
                                  disabled={generating === item.id}
                                  title="生成素材卡"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant={
                                    markedRead.has(item.id)
                                      ? "default"
                                      : "ghost"
                                  }
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => toggleMarkRead(item.id)}
                                  title="标记已读"
                                >
                                  <CheckCircle
                                    className={`h-3.5 w-3.5 ${
                                      markedRead.has(item.id)
                                        ? "fill-current"
                                        : ""
                                    }`}
                                  />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-3">
          <span className="text-sm text-muted-foreground">
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
