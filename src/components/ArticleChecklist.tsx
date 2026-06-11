"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function useArticleChecklist() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, clear };
}

export function BatchFavoriteBar({
  selected,
  onClear,
}: {
  selected: Set<string>;
  onClear: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const count = selected.size;

  async function batchFavorite() {
    if (loading || count === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentItemIds: Array.from(selected) }),
      });
      const j = await res.json();
      if (res.ok) {
        const msg = `已收藏 ${j.added} 篇${
          j.skipped ? `，${j.skipped} 篇未审核跳过` : ""
        }`;
        toast.success(msg);
        onClear();
      } else {
        toast.error(j.error ?? "收藏失败");
      }
    } finally {
      setLoading(false);
    }
  }

  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 z-50">
      <span>已选 {count} 篇</span>
      <Button
        onClick={batchFavorite}
        disabled={loading}
        size="sm"
        variant="default"
      >
        {loading ? "处理中..." : "收藏选中"}
      </Button>
      <button onClick={onClear} className="text-sm text-gray-300 hover:text-white">
        取消
      </button>
    </div>
  );
}
