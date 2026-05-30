"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeFilter, type DateRange } from "@/components/filters/DateRangeFilter";
import { BatchActions } from "@/components/BatchActions";
import { ArticleDetail } from "@/components/ArticleDetail";
import { Pagination } from "@/components/ui/pagination";
import { RefreshCw, Search, Play, Brain, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ContentItemData {
  id: string;
  title: string;
  originalUrl: string;
  platform: string;
  fullText: string | null;
  excerpt: string | null;
  contentType: string;
  topicTags: string;
  publishedAt: string | null;
  createdAt: string;
  processingStatus: string;
  qualityStatus: string;
  filterReason: string | null;
  aiScore: number | null;
  aiDecision: string | null;
  aiReason: string | null;
  contentGenre: string | null;
  aiAssessedAt: string | null;
  aiScoreDetail: string | null;
  aiScoredAt: string | null;
  effectiveTextLength: number;
  source?: { name: string } | null;
  _count: { materialCards: number };
}

interface ContentItemsResponse {
  data: ContentItemData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const QUALITY_STATUS_OPTIONS = [
  { value: "all", label: "全部质量" },
  { value: "pending", label: "待检测" },
  { value: "candidate", label: "候选" },
  { value: "filtered", label: "已过滤" },
  { value: "accepted", label: "已接受" },
];

const AI_DECISION_OPTIONS = [
  { value: "all", label: "全部 AI" },
  { value: "pending", label: "待评估" },
  { value: "accept", label: "AI 接受" },
  { value: "reject", label: "AI 拒绝" },
];

const CONTENT_GENRE_LABELS: Record<string, string> = {
  commentary: "评论",
  policy_interpretation: "政策解读",
  case_practice: "案例实践",
  ordinary_news: "普通新闻",
  meeting_news: "会议新闻",
  notice: "通知公告",
  other: "其他",
};

const GENRE_BADGE_COLORS: Record<string, string> = {
  commentary: "bg-blue-100 text-blue-700",
  policy_interpretation: "bg-purple-100 text-purple-700",
  case_practice: "bg-green-100 text-green-700",
  ordinary_news: "bg-gray-100 text-gray-500",
  meeting_news: "bg-gray-100 text-gray-500",
  notice: "bg-gray-100 text-gray-500",
  other: "bg-gray-100 text-gray-500",
};

export default function ArticlesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContentItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [qualityStatus, setQualityStatus] = useState("all");
  const [aiDecision, setAiDecision] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [sortBy, setSortBy] = useState("createdAt");

  // Collection state
  const [collecting, setCollecting] = useState(false);
  const [collectProgress, setCollectProgress] = useState<string | null>(null);

  // AI assessment state
  const [assessing, setAssessing] = useState(false);
  const [assessProgress, setAssessProgress] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail view
  const [detailItem, setDetailItem] = useState<ContentItemData | null>(null);

  const [pageSize, setPageSize] = useState(20);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (qualityStatus !== "all") params.set("qualityStatus", qualityStatus);
      if (aiDecision !== "all") params.set("aiDecision", aiDecision);
      if (dateRange.from) params.set("dateFrom", dateRange.from);
      if (dateRange.to) params.set("dateTo", dateRange.to);
      if (sortBy !== "createdAt") params.set("sortBy", sortBy);

      const res = await fetch(`/api/articles?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: ContentItemsResponse = await res.json();
      setItems(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, qualityStatus, aiDecision, dateRange, sortBy]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [search, qualityStatus, aiDecision, dateRange, sortBy, pageSize]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((a) => a.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  // 开始采集
  async function handleCollect() {
    setCollecting(true);
    setCollectProgress("正在采集...");
    try {
      const res = await fetch("/api/collectors/web/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // 空 body = 采集所有启用的来源
      });
      const data = await res.json();
      if (res.ok) {
        setCollectProgress(`采集完成：发现 ${data.discoveredCount ?? 0} 篇，导入 ${data.importedCount ?? 0} 篇`);
        fetchItems();
      } else {
        setCollectProgress(`采集失败: ${data.error}`);
      }
    } catch {
      setCollectProgress("采集请求失败");
    } finally {
      setCollecting(false);
      setTimeout(() => setCollectProgress(null), 5000);
    }
  }

  // AI 批量评估
  async function handleAssess() {
    const idsToAssess = selected.size > 0
      ? Array.from(selected)
      : items.filter((i) => i.qualityStatus === "candidate" && !i.aiDecision).map((i) => i.id);

    if (idsToAssess.length === 0) {
      alert("没有可评估的条目");
      return;
    }

    setAssessing(true);
    setAssessProgress(`正在评估 ${idsToAssess.length} 个条目...`);
    try {
      const res = await fetch("/api/content-items/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToAssess }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssessProgress(`评估完成：接受 ${data.accepted} 篇，拒绝 ${data.rejected} 篇`);
        setSelected(new Set());
        fetchItems();
      } else {
        setAssessProgress(`评估失败: ${data.error}`);
      }
    } catch {
      setAssessProgress("评估请求失败");
    } finally {
      setAssessing(false);
      setTimeout(() => setAssessProgress(null), 5000);
    }
  }

  async function handleGenerate() {
    if (selected.size === 0) return;

    setGenerating(true);
    setGenerateProgress(`正在为 ${selected.size} 个内容条目生成素材卡...`);

    try {
      const res = await fetch("/api/material-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemIds: Array.from(selected) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "生成失败");
      }

      const result = await res.json();
      setGenerateProgress(
        `生成完成：成功 ${result.success} 张，失败 ${result.failed} 张`
      );

      setSelected(new Set());
      fetchItems();

      setTimeout(() => {
        setGenerateProgress(null);
        router.push("/cards");
      }, 2000);
    } catch (err) {
      setGenerateProgress(null);
      alert(err instanceof Error ? err.message : "生成素材卡失败");
    } finally {
      setGenerating(false);
    }
  }

  const allSelected = items.length > 0 && items.every((a) => selected.has(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">内容列表</h1>
            <p className="text-sm text-muted-foreground">
              管理采集的内容条目，AI 评估后生成素材卡
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleCollect}
              disabled={collecting}
            >
              {collecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              {collecting ? "采集中..." : "开始采集"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAssess}
              disabled={assessing}
            >
              {assessing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-1.5 h-4 w-4" />
              )}
              {assessing ? "评估中..." : "AI 评估"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchItems}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>
        {/* Progress messages */}
        {(collectProgress || assessProgress) && (
          <div className="mt-2 text-sm text-muted-foreground">
            {collectProgress && <p>{collectProgress}</p>}
            {assessProgress && <p>{assessProgress}</p>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <Select value={qualityStatus} onValueChange={(v) => { if (v) setQualityStatus(v); }}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="质量" />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={aiDecision} onValueChange={(v) => { if (v) setAiDecision(v); }}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="AI" />
            </SelectTrigger>
            <SelectContent>
              {AI_DECISION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => { if (v) setSortBy(v); }}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">按时间</SelectItem>
              <SelectItem value="aiScore">按评分</SelectItem>
              <SelectItem value="effectiveTextLength">按字数</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col overflow-hidden ${detailItem ? "w-1/2" : "w-full"}`}>
          {/* Batch actions */}
          <div className="px-6 py-3">
            <BatchActions
              selectedCount={selected.size}
              totalCount={total}
              allSelected={allSelected}
              generating={generating}
              progress={generateProgress}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onGenerate={handleGenerate}
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6">
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
                <p>暂无内容</p>
                <p className="text-sm">点击「开始采集」获取内容</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          if (checked) selectAll();
                          else deselectAll();
                        }}
                      />
                    </TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-20">来源</TableHead>
                    <TableHead className="w-20">体裁</TableHead>
                    <TableHead className="w-16">质量</TableHead>
                    <TableHead className="w-16">AI</TableHead>
                    <TableHead className="w-14">字数</TableHead>
                    <TableHead className="w-16 text-right">素材卡</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setDetailItem(item)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[280px] truncate">
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.source?.name ?? item.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.contentGenre ? (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${GENRE_BADGE_COLORS[item.contentGenre] ?? ""}`}
                          >
                            {CONTENT_GENRE_LABELS[item.contentGenre] ?? item.contentGenre}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.qualityStatus === "accepted" ? "default" : item.qualityStatus === "filtered" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {item.qualityStatus === "accepted" ? "通过" : item.qualityStatus === "filtered" ? "过滤" : item.qualityStatus === "candidate" ? "候选" : "待检"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.aiDecision === "accept" ? (
                          <Badge variant="default" className="text-xs bg-green-600">接受</Badge>
                        ) : item.aiDecision === "reject" ? (
                          <Badge variant="destructive" className="text-xs">拒绝</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.effectiveTextLength ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item._count.materialCards}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>

        {/* Detail panel */}
        {detailItem && (
          <div className="w-1/2 border-l overflow-hidden">
            <ArticleDetail
              article={detailItem}
              onClose={() => setDetailItem(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
