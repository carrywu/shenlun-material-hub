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
import { RegionFilter } from "@/components/filters/RegionFilter";
import { TopicFilter } from "@/components/filters/TopicFilter";
import { SourceFilter } from "@/components/filters/SourceFilter";
import { BatchActions } from "@/components/BatchActions";
import { ArticleDetail } from "@/components/ArticleDetail";
import { Pagination } from "@/components/ui/pagination";
import { RefreshCw, Search, Star } from "lucide-react";
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
  filterReason: string | null;
  aiScore: number | null;
  aiScoreDetail: string | null;
  aiScoredAt: string | null;
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
  const [source, setSource] = useState("all");
  const [contentType, setContentType] = useState("all");
  const [tags, setTags] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [processingStatus, setProcessingStatus] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");

  // Scoring state
  const [scoringId, setScoringId] = useState<string | null>(null);

  const PROCESSING_STATUS_OPTIONS = [
    { value: "all", label: "全部状态" },
    { value: "pending", label: "待处理" },
    { value: "fetched", label: "已抓取" },
    { value: "card_generated", label: "卡片已生成" },
    { value: "filtered", label: "已过滤" },
  ];

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
      if (source !== "all") params.set("source", source);
      if (contentType !== "all") params.set("category", contentType);
      if (tags !== "all") params.set("tags", tags);
      if (dateRange.from) params.set("dateFrom", dateRange.from);
      if (dateRange.to) params.set("dateTo", dateRange.to);
      if (processingStatus !== "all") params.set("processingStatus", processingStatus);
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
  }, [page, pageSize, search, source, contentType, tags, dateRange, processingStatus, sortBy]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, source, contentType, tags, dateRange, processingStatus, sortBy, pageSize]);

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

      // Clear selection and refresh
      setSelected(new Set());
      fetchItems();

      // Navigate to cards page after a brief delay
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

  async function handleScore(id: string) {
    if (scoringId) return;
    setScoringId(id);
    try {
      const res = await fetch(`/api/content-items/${id}/score`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "评分失败");
      }
      fetchItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : "AI 评分失败");
    } finally {
      setScoringId(null);
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
              管理采集的内容条目，筛选并生成素材卡
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <SourceFilter value={source} onChange={setSource} />
          <TopicFilter value={contentType} onChange={setContentType} />
          <RegionFilter value={tags} onChange={setTags} />
          <Select value={processingStatus} onValueChange={(v) => { if (v) setProcessingStatus(v); }}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              {PROCESSING_STATUS_OPTIONS.map((opt) => (
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
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table area */}
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
                <p className="text-sm">请调整筛选条件或采集新内容</p>
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
                    <TableHead className="w-24">来源</TableHead>
                    <TableHead className="w-28">发布日期</TableHead>
                    <TableHead className="w-20">类型</TableHead>
                    <TableHead className="w-14">评分</TableHead>
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
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.source?.name ?? item.platform}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleDateString("zh-CN")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {item.contentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.aiScore !== null ? (
                          <span
                            className={`text-sm font-medium ${
                              item.aiScore >= 7
                                ? "text-green-600"
                                : item.aiScore >= 5
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {item.aiScore}
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScore(item.id);
                            }}
                            disabled={scoringId === item.id}
                            title="AI 评分"
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
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
