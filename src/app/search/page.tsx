"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { MaterialCardView } from "@/components/MaterialCard";
import type { CardType } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SearchCard {
  id: string;
  title: string;
  aiSummary: string | null;
  markdownContent: string | null;
  userEditedContent: string | null;
  cardType: string;
  confirmed: boolean;
  originalFacts: string | null;
  createdAt: string;
  contentItem?: {
    id: string;
    title: string;
    source: { name: string } | null;
  };
}

const CARD_TYPES = [
  "golden_sentence",
  "standard_expression",
  "case_material",
  "countermeasure",
  "problem_statement",
  "reason_analysis",
  "policy_expression",
  "person_story",
  "article_structure",
];

const CARD_TYPE_LABELS: Record<string, string> = {
  golden_sentence: "申论金句",
  standard_expression: "规范词",
  case_material: "案例素材",
  countermeasure: "对策表达",
  problem_statement: "问题表述",
  reason_analysis: "原因分析",
  policy_expression: "政策表述",
  data_fact: "案例素材",
  person_story: "人物事迹",
  article_structure: "文章框架",
  // Legacy fallback
  fact_summary: "案例素材",
  argument_analysis: "原因分析",
  data_highlight: "案例素材",
  policy_compare: "政策表述",
  case_study: "案例素材",
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [tags, setTags] = useState("");
  const [confirmed, setConfirmed] = useState("all");
  const [results, setResults] = useState<SearchCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(
    async (p: number = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (cardType) params.set("category", cardType);
        if (tags) params.set("tags", tags);
        if (confirmed !== "all") params.set("confirmed", confirmed);
        params.set("page", String(p));
        params.set("pageSize", "20");

        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();

        if (res.ok) {
          setResults(data.data);
          setTotal(data.total);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setHasSearched(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [query, cardType, tags, confirmed]
  );

  // Search on Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      search(1);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setCardType("");
    setTags("");
    setConfirmed("all");
    setResults([]);
    setHasSearched(false);
    setTotal(0);
  };

  const highlightText = (text: string, q: string) => {
    if (!q || !text) return text;
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (cardType) params.set("category", cardType);
    if (tags) params.set("tags", tags);
    if (confirmed !== "all") params.set("confirmed", confirmed);
    window.open(`/api/export?${params.toString()}`, "_blank");
  };

  const activeFilters = [
    cardType && { key: "cardType", label: `类型: ${CARD_TYPE_LABELS[cardType] ?? cardType}` },
    tags && { key: "tags", label: `标签: ${tags}` },
    confirmed !== "all" && {
      key: "confirmed",
      label: confirmed === "true" ? "已确认" : "未确认",
    },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <PageHeader
          title="素材卡检索"
          description="全文搜索素材卡内容，支持按类型和标签筛选"
          data-testid="search-page-header"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={total === 0}
            >
              <Download className="h-4 w-4 mr-1.5" />
              导出 Markdown
            </Button>
          }
        />
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="输入关键词搜索素材卡..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button onClick={() => search(1)} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "搜索"
            )}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={cardType}
            onValueChange={(v) => setCardType(v === "all" || !v ? "" : v)}
          >
            <SelectTrigger className="w-32" aria-label="素材卡类型">
              <SelectValue>
                {cardType === "" ? "全部类型" : (CARD_TYPE_LABELS[cardType] ?? cardType)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {CARD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CARD_TYPE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="标签（逗号分隔）"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-48"
          />

          <Select value={confirmed} onValueChange={(v) => { if (v) setConfirmed(v); }}>
            <SelectTrigger className="w-32" aria-label="确认状态">
              <SelectValue>
                {confirmed === "all" ? "全部状态" : (confirmed === "true" ? "已确认" : "未确认")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="true">已确认</SelectItem>
              <SelectItem value="false">未确认</SelectItem>
            </SelectContent>
          </Select>

          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              清除筛选
            </Button>
          )}
        </div>

        {/* Active filter badges */}
        {activeFilters.length > 0 && (
          <div className="flex gap-1.5">
            {activeFilters.map((f) => (
              <Badge key={f.key} variant="secondary" className="text-xs">
                {f.label}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    if (f.key === "cardType") setCardType("");
                    if (f.key === "tags") setTags("");
                    if (f.key === "confirmed") setConfirmed("all");
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Results */}
        {hasSearched && (
          <div className="space-y-3">
            {results.length > 0 && (
              <div className="text-sm text-muted-foreground">
                共找到 {total} 条结果
                {query && (
                  <span>
                    ，关键词：<strong>{query}</strong>
                  </span>
                )}
              </div>
            )}

            {results.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-base font-medium">未找到匹配的素材卡</p>
                  <p className="text-sm mt-1">尝试调整搜索关键词或筛选条件</p>
                  {activeFilters.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-3"
                    >
                      <X className="h-3 w-3 mr-1" />
                      清空所有筛选条件
                    </Button>
                  )}
                  <div className="flex gap-4 mt-3">
                    <Link href="/articles" className="text-sm text-primary hover:underline">
                      前往文章库浏览 →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.map((card) => {
                  return (
                    <div
                      key={card.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/cards/${card.id}`)}
                    >
                      <MaterialCardView
                        id={card.id}
                        title={query ? highlightText(card.title, query) as unknown as string : card.title}
                        cardType={card.cardType as CardType}
                        confirmed={card.confirmed}
                        aiSummary={card.aiSummary}
                        sourceSnapshot={card.markdownContent}
                        contentItemTitle={card.contentItem?.title}
                        sourceName={card.contentItem?.source?.name}
                      />
                      {card.originalFacts && (
                        <div className="mt-1 px-1">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {query
                              ? highlightText(card.originalFacts, query)
                              : card.originalFacts}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => search(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => search(page + 1)}
                  disabled={page >= totalPages || loading}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Initial state */}
        {!hasSearched && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-lg font-medium">搜索素材卡</p>
              <p className="text-sm">
                输入关键词后按 Enter 或点击搜索按钮
              </p>
              <div className="flex gap-4 mt-4">
                <Link href="/cards" className="text-sm text-primary hover:underline">
                  浏览全部素材卡 →
                </Link>
                <Link href="/articles" className="text-sm text-primary hover:underline">
                  前往文章库 →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
