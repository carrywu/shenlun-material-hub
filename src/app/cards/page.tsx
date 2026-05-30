"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialCardView } from "@/components/MaterialCard";
import { BatchSyncToIma } from "@/components/SyncToIma";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
  Upload,
  FileText,
  BookOpen,
  BarChart3,
  GitCompare,
  Lightbulb,
} from "lucide-react";
import type { CardType } from "@/types";

interface CardItem {
  id: string;
  title: string;
  cardType: CardType;
  confirmed: boolean;
  sourceSnapshot: string | null;
  originalFacts: string | null;
  aiSummary: string | null;
  highlightSuggestions: string | null;
  transferSuggestions: string | null;
  createdAt: string;
  contentItem: {
    id: string;
    title: string;
    source: { name: string } | null;
  };
}

interface CardsResponse {
  data: CardItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CARD_TYPE_TABS: { value: CardType | "all"; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "全部", icon: FileText },
  { value: "fact_summary", label: "事实摘要", icon: FileText },
  { value: "argument_analysis", label: "论点分析", icon: BookOpen },
  { value: "data_highlight", label: "数据亮点", icon: BarChart3 },
  { value: "policy_compare", label: "政策对比", icon: GitCompare },
  { value: "case_study", label: "案例研究", icon: Lightbulb },
];

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<CardType | "all">("all");
  const [confirmedFilter, setConfirmedFilter] = useState<string>("all");

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchSync, setShowBatchSync] = useState(false);

  const pageSize = 12;

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (cardTypeFilter !== "all") params.set("cardType", cardTypeFilter);
      if (confirmedFilter !== "all") params.set("confirmed", confirmedFilter);

      const res = await fetch(`/api/material-cards?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: CardsResponse = await res.json();
      setCards(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, search, cardTypeFilter, confirmedFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, cardTypeFilter, confirmedFilter]);

  async function handleDelete(id: string) {
    if (!confirm("确定删除此素材卡？")) return;
    try {
      const res = await fetch(`/api/material-cards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      fetchCards();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleConfirm(id: string) {
    try {
      const card = cards.find((c) => c.id === id);
      if (!card) return;
      const res = await fetch(`/api/material-cards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: !card.confirmed }),
      });
      if (!res.ok) throw new Error("操作失败");
      fetchCards();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(cards.map((c) => c.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
    setShowBatchSync(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">素材卡管理</h1>
            <p className="text-sm text-muted-foreground">
              查看和管理 AI 生成的申论素材卡
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCards}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索素材卡..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[
                { value: "all", label: "全部" },
                { value: "true", label: "已确认" },
                { value: "false", label: "未确认" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={confirmedFilter === opt.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfirmedFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            共 {total} 张素材卡
          </Badge>
        </div>
      </div>

      {/* Card type tabs */}
      <div className="border-b px-6 py-2">
        <Tabs
          value={cardTypeFilter}
          onValueChange={(v) => setCardTypeFilter(v as CardType | "all")}
        >
          <TabsList className="h-8">
            {CARD_TYPE_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1 px-2.5">
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="border-b px-6 py-3">
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
            <Checkbox
              checked={selectedIds.size === cards.length}
              onCheckedChange={(checked) => {
                if (checked) selectAll();
                else deselectAll();
              }}
            />
            <span className="text-sm text-muted-foreground">
              已选 {selectedIds.size} / {cards.length} 张
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBatchSync(!showBatchSync)}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              批量同步
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              <X className="mr-1 h-4 w-4" />
              取消选择
            </Button>
          </div>
          {showBatchSync && (
            <div className="mt-3">
              <BatchSyncToIma
                cardIds={Array.from(selectedIds)}
                onSyncComplete={() => {
                  deselectAll();
                  fetchCards();
                }}
              />
            </div>
          )}
        </div>
      )}

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
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <p>暂无素材卡</p>
            <p className="text-sm">请在内容列表中选择内容条目生成素材卡</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div key={card.id} className="relative">
                <div
                  className="absolute top-3 left-3 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(card.id)}
                    onCheckedChange={() => toggleSelect(card.id)}
                    className="bg-background border-2"
                  />
                </div>
                <div
                  className="cursor-pointer"
                  onClick={() => router.push(`/cards/${card.id}`)}
                >
                  <MaterialCardView
                    id={card.id}
                    title={card.title}
                    cardType={card.cardType}
                    confirmed={card.confirmed}
                    sourceSnapshot={card.sourceSnapshot}
                    originalFacts={card.originalFacts}
                    aiSummary={card.aiSummary}
                    highlightSuggestions={card.highlightSuggestions}
                    transferSuggestions={card.transferSuggestions}
                    contentItemTitle={card.contentItem.title}
                    sourceName={card.contentItem.source?.name}
                    onDelete={handleDelete}
                    onConfirm={handleConfirm}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-3">
          <span className="text-sm text-muted-foreground">
            共 {total} 张，第 {page} / {totalPages} 页
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
