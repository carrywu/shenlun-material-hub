"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  contentItemId: string;
  favorited: boolean;
}

export function FavoriteButton({ contentItemId, favorited }: Props) {
  const [state, setState] = useState(favorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return; // 防抖
    setLoading(true);
    try {
      if (!state) {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentItemIds: [contentItemId] }),
        });
        const j = await res.json();
        if (res.ok && j.added > 0) {
          setState(true);
          toast.success("已加入我的文章");
        } else if (res.ok && j.alreadyFavorited > 0) {
          setState(true);
          toast.info("已在你的文章中");
        } else {
          toast.error(j.error ?? "收藏失败");
        }
      } else {
        if (!confirm("移除后该文章下你生成的素材卡也会删除，确定？")) return;
        const res = await fetch(`/api/favorites/${contentItemId}`, { method: "DELETE" });
        if (res.ok) {
          setState(false);
          toast.success("已移除");
        } else {
          toast.error("移除失败");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={toggle}
      disabled={loading}
      variant={state ? "secondary" : "default"}
      size="sm"
    >
      {loading ? "处理中..." : state ? "✓ 已收藏" : "+ 加入我的文章"}
    </Button>
  );
}
