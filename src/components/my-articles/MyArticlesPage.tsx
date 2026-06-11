"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface FavoriteItem {
  userId: string;
  contentItemId: string;
  createdAt: string;
  contentItem: {
    id: string;
    title: string;
    coverUrl: string | null;
    publishedAt: string | null;
    adminReviewStatus: string | null;
  };
}

export function MyArticlesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/favorites");
      const j = await res.json();
      setItems(j.data ?? []);
    } catch {
      toast.error("加载收藏失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  async function handleRemove(contentItemId: string) {
    if (!confirm("移除后该文章下你生成的素材卡也会删除，确定？")) return;
    const res = await fetch(`/api/favorites/${contentItemId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("已移除");
      setItems((prev) => prev.filter((i) => i.contentItemId !== contentItemId));
    } else {
      toast.error("移除失败");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的文章</h1>
        <p className="text-sm text-muted-foreground mt-1">
          你收藏的文章。共 {items.length} 篇。
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">还没有收藏文章</p>
            <div className="flex gap-3 justify-center">
              <Link href="/discover" className="text-blue-600 hover:underline">
                去今日推荐看看
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/explore" className="text-blue-600 hover:underline">
                去探索区看看
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.contentItemId}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/articles/${item.contentItemId}`}
                    className="font-medium hover:underline truncate block"
                  >
                    {item.contentItem.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.contentItem.publishedAt
                      ? new Date(item.contentItem.publishedAt).toLocaleDateString()
                      : "未知日期"}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemove(item.contentItemId)}
                >
                  移除
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
