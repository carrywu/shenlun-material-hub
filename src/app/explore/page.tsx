"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Search,
  RefreshCw,
  ShieldQuestion,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { CONTENT_TYPES, PLATFORMS } from "@/types";
import { VERIFICATION_LABELS } from "@/lib/display-labels";
import { useArticleChecklist, BatchFavoriteBar } from "@/components/ArticleChecklist";
import { Checkbox } from "@/components/ui/checkbox";

interface ExploreItem {
  id: string;
  title: string;
  originalUrl: string;
  platform: string;
  contentType: string;
  trustLevel: string;
  excerpt: string | null;
  publishedAt: string | null;
  processingStatus: string;
  verificationStatus: string;
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

interface ExploreResponse {
  data: ExploreItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
}

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
  // 种子数据扩展类型
  local_official: "地方政务",
  official_primary: "核心官媒",
  official_case: "官方案例",
  government_policy: "政府政策",
  wechat_official: "微信公众号",
  creator_content: "创作者内容",
};

const PLATFORM_LABELS: Record<string, string> = {
  website: "网站",
  wechat: "微信",
  bilibili: "B站",
  xiaohongshu: "小红书",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  fetched: "已抓取",
  parsed: "已解析",
  analyzing: "分析中",
  card_generated: "卡片已生成",
  card_edited: "卡片已编辑",
  confirmed: "已确认",
  synced: "已同步",
};

export default function ExplorePage() {
  const router = useRouter();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filters
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [contentType, setContentType] = useState("all");

  // Actions state
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const { selected, toggle: toggleSelect, clear: clearSelection } = useArticleChecklist();
  const pageSize = 20;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (platform !== "all") params.set("platform", platform);
      if (contentType !== "all") params.set("contentType", contentType);

      const res = await fetch(`/api/explore?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: ExploreResponse = await res.json();
      setItems(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, platform, contentType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedQuery, platform, contentType]);

  function toggleIgnore(id: string) {
    setIgnored((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleVerifySource(sourceId: string) {
    try {
      const res = await fetch(`/api/sources/${sourceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: "verified" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "核验失败");
      }
      setVerified((prev) => new Set(prev).add(sourceId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "核验来源失败");
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">探索区</h1>
            <p className="text-sm text-muted-foreground">
              全部已审核通过的文章，可按平台/类型筛选
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">共 {total} 条</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标题、摘要、全文、标签..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8"
            />
            {query && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={platform} onValueChange={(v) => { if (v) setPlatform(v); }}>
            <SelectTrigger className="w-32 h-8" aria-label="平台">
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
            <SelectTrigger className="w-36 h-8" aria-label="内容类型">
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
            搜索中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <ShieldQuestion className="h-8 w-8" />
            <p>{debouncedQuery ? "未找到匹配内容" : "暂无已审核文章"}</p>
            <p className="text-sm">
              {debouncedQuery
                ? "请尝试其他关键词"
                : "暂无已审核通过的文章"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isIgnored = ignored.has(item.id);
              const isSourceVerified = verified.has(item.source.id);
              return (
                <div
                  key={item.id}
                  onClick={() => router.push(`/articles/${item.id}`)}
                  className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                    isIgnored
                      ? "bg-muted/30 opacity-50"
                      : "bg-card hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/articles/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-sm hover:underline text-slate-800"
                          >
                            {item.title}
                          </Link>
                        </div>

                        {item.excerpt && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {item.excerpt}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]" onClick={(e) => e.stopPropagation()}>
                            {item.source.name}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {CONTENT_TYPE_LABELS[item.contentType] ??
                              item.contentType}
                          </Badge>
                          <Badge
                            variant={
                              item.source.verificationStatus === "unverified"
                                ? "outline"
                                : "secondary"
                            }
                            className={`text-[10px] ${
                              item.source.verificationStatus === "disputed"
                                ? "bg-yellow-100 text-yellow-800"
                                : ""
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {VERIFICATION_LABELS[item.source.verificationStatus] ??
                              item.source.verificationStatus}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]" onClick={(e) => e.stopPropagation()}>
                            {STATUS_LABELS[item.processingStatus] ??
                              item.processingStatus}
                          </Badge>
                          {item.publishedAt && (
                            <span className="text-[10px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                              {new Date(item.publishedAt).toLocaleDateString(
                                "zh-CN"
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 border rounded bg-background hover:bg-muted/50 transition-colors h-7"
                        onClick={(e) => e.stopPropagation()}
                        title="查看外部原文"
                      >
                        <ExternalLink className="h-3 w-3" />
                        查看原文
                      </a>

                      {!isSourceVerified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerifySource(item.source.id);
                          }}
                          title="核验来源"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          核验
                        </Button>
                      )}
                      {isSourceVerified && (
                        <Badge
                          variant="default"
                          className="text-[10px] bg-green-600 h-7 flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          已核验
                        </Badge>
                      )}
                      <Button
                        variant={isIgnored ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleIgnore(item.id);
                        }}
                        title="忽略"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* Batch favorite bar */}
      <BatchFavoriteBar selected={selected} onClear={clearSelection} />
    </div>
  );
}
