"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MaterialCardView } from "@/components/MaterialCard";
import { ChevronLeft, ChevronRight, RefreshCw, Search, Filter } from "lucide-react";

interface CardItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  confirmed: boolean;
  createdAt: string;
  article: {
    id: string;
    title: string;
    source: string;
  };
}

interface CardsResponse {
  data: CardItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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
  const [confirmedFilter, setConfirmedFilter] = useState<string>("all");
  const [articleFilter, setArticleFilter] = useState<string>("");

  const pageSize = 12;

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (confirmedFilter !== "all") params.set("confirmed", confirmedFilter);
      if (articleFilter) params.set("articleId", articleFilter);

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
  }, [page, search, confirmedFilter, articleFilter]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    setPage(1);
  }, [search, confirmedFilter, articleFilter]);

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
            <Filter className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-sm">请在文章列表中选择文章批量生成素材卡</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className="cursor-pointer"
                onClick={() => router.push(`/cards/${card.id}`)}
              >
                <MaterialCardView
                  id={card.id}
                  title={card.title}
                  content={card.content}
                  category={card.category}
                  tags={card.tags}
                  confirmed={card.confirmed}
                  articleTitle={card.article.title}
                  articleSource={card.article.source}
                  onDelete={handleDelete}
                  onConfirm={handleConfirm}
                />
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
