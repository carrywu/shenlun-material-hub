"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ArticleItem {
  id: string;
  title: string;
  url: string;
  source: string;
  content: string;
  summary: string | null;
  category: string;
  tags: string;
  publishedAt: string | null;
  createdAt: string;
  _count: { materialCards: number };
}

interface ArticlesResponse {
  data: ArticleItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleItem[]>([]);
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
  const [category, setCategory] = useState("all");
  const [tags, setTags] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail view
  const [detailArticle, setDetailArticle] = useState<ArticleItem | null>(null);

  const pageSize = 20;

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (source !== "all") params.set("source", source);
      if (category !== "all") params.set("category", category);
      if (tags !== "all") params.set("tags", tags);
      if (dateRange.from) params.set("dateFrom", dateRange.from);
      if (dateRange.to) params.set("dateTo", dateRange.to);

      const res = await fetch(`/api/articles?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: ArticlesResponse = await res.json();
      setArticles(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, search, source, category, tags, dateRange]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, source, category, tags, dateRange]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(articles.map((a) => a.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleGenerate() {
    if (selected.size === 0) return;

    setGenerating(true);
    setGenerateProgress(`正在为 ${selected.size} 篇文章生成素材卡...`);

    try {
      const res = await fetch("/api/material-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: Array.from(selected) }),
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
      fetchArticles();

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

  const allSelected = articles.length > 0 && articles.every((a) => selected.has(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">文章列表</h1>
            <p className="text-sm text-muted-foreground">
              管理采集的官方文章，筛选并生成素材卡
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchArticles}>
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
              placeholder="搜索文章标题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <SourceFilter value={source} onChange={setSource} />
          <TopicFilter value={category} onChange={setCategory} />
          <RegionFilter value={tags} onChange={setTags} />
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table area */}
        <div className={`flex-1 flex flex-col overflow-hidden ${detailArticle ? "w-1/2" : "w-full"}`}>
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
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <p>暂无文章</p>
                <p className="text-sm">请调整筛选条件或采集新文章</p>
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
                    <TableHead className="w-20">栏目</TableHead>
                    <TableHead className="w-24">标签</TableHead>
                    <TableHead className="w-16 text-right">素材卡</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow
                      key={article.id}
                      className="cursor-pointer"
                      onClick={() => setDetailArticle(article)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(article.id)}
                          onCheckedChange={() => toggleSelect(article.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {article.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {article.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString("zh-CN")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {article.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px]">
                        <div className="flex flex-wrap gap-1">
                          {article.tags
                            .split(",")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {article._count.materialCards}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-3">
              <span className="text-sm text-muted-foreground">
                共 {total} 篇，第 {page} / {totalPages} 页
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

        {/* Detail panel */}
        {detailArticle && (
          <div className="w-1/2 border-l overflow-hidden">
            <ArticleDetail
              article={detailArticle}
              onClose={() => setDetailArticle(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
