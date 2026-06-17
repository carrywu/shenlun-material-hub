"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckSquare, Square } from "lucide-react";

export interface PreviewArticle {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishTime?: string;
  cover?: string;
  effectiveTextLength: number;
  filtered: boolean;
  filterReason?: string;
  contentPreview: string;
  isDuplicate: boolean;
  isRefreshable: boolean;
}

interface ArticlePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: PreviewArticle[];
  loading: boolean;
  onConfirm: (selectedUrls: string[], forceReimport: boolean) => void;
  sourceName?: string;
}

export function ArticlePreviewDialog({
  open,
  onOpenChange,
  articles,
  loading,
  onConfirm,
  sourceName,
}: ArticlePreviewDialogProps) {
  // 默认选中未过滤的文章 + 可刷新文章
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const a of articles) {
      if (!a.filtered || a.isRefreshable) s.add(a.url);
    }
    return s;
  });

  // articles 变化时重置选中
  const prevLen = useMemo(() => articles.length, [articles]);
  const [lastLen, setLastLen] = useState(0);
  if (prevLen !== lastLen) {
    setLastLen(prevLen);
    const s = new Set<string>();
    for (const a of articles) {
      if (!a.filtered || a.isRefreshable) s.add(a.url);
    }
    setSelected(s);
  }

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(articles.map((a) => a.url)));
  const deselectAll = () => setSelected(new Set());

  const selectedCount = selected.size;
  const totalCount = articles.length;
  const passedCount = articles.filter((a) => !a.filtered).length;
  const filteredCount = articles.filter((a) => a.filtered).length;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>正在获取文章预览…</DialogTitle>
            <DialogDescription>
              {sourceName ? `来源：${sourceName}` : "正在拉取文章列表"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            采集预览{sourceName ? `：${sourceName}` : ""}
          </DialogTitle>
          <DialogDescription>
            共 {totalCount} 篇，通过 {passedCount} 篇，过滤 {filteredCount} 篇
          </DialogDescription>
        </DialogHeader>

        {/* 操作栏 */}
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={selectAll}>
            <CheckSquare className="h-4 w-4 mr-1" />
            全选
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            <Square className="h-4 w-4 mr-1" />
            取消全选
          </Button>
          <span className="text-muted-foreground ml-auto">
            已选 {selectedCount} / {totalCount}
          </span>
        </div>

        {/* 文章列表 */}
        <div className="flex-1 overflow-y-auto border rounded-md divide-y">
          {articles.map((article) => {
            const isSelected = selected.has(article.url);
            const lenColor =
              article.effectiveTextLength >= 1000
                ? "text-green-600"
                : article.effectiveTextLength >= 300
                  ? "text-yellow-600"
                  : "text-red-600";

            return (
              <div
                key={article.url}
                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                  article.filtered ? "opacity-60" : ""
                }`}
                onClick={() => toggle(article.url)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggle(article.url)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {article.title}
                    </span>
                    {article.isRefreshable && (
                      <Badge variant="outline" className="text-xs shrink-0 border-green-300 text-green-700">
                        可刷新
                      </Badge>
                    )}
                    {article.isDuplicate && !article.isRefreshable && (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        重复
                      </Badge>
                    )}
                    {article.filtered && !article.isRefreshable && (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        过滤
                      </Badge>
                    )}
                  </div>
                  {article.filterReason && (
                    <p className="text-xs text-destructive mt-0.5">
                      {article.filterReason}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {article.contentPreview || "(无正文预览)"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {article.author && <span>{article.author}</span>}
                    <span className={lenColor}>
                      {article.effectiveTextLength} 字
                    </span>
                    {article.publishTime && (
                      <span>
                        {new Date(article.publishTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              const hardDuplicateCount = articles.filter(
                (a) => selected.has(a.url) && a.isDuplicate && !a.isRefreshable
              ).length;
              if (hardDuplicateCount > 0) {
                const ok = window.confirm(
                  `选中文章中有 ${hardDuplicateCount} 篇为已存在的重复文章，导入将覆盖原有内容。是否继续？`
                );
                if (!ok) return;
                onConfirm(Array.from(selected), true);
              } else {
                onConfirm(Array.from(selected), false);
              }
            }}
            disabled={selectedCount === 0}
          >
            确认导入（{selectedCount} 篇）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
