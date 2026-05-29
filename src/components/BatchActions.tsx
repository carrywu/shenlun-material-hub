"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Loader2, X } from "lucide-react";

interface BatchActionsProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  generating?: boolean;
  progress?: string | null;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onGenerate: () => void;
}

export function BatchActions({
  selectedCount,
  totalCount,
  allSelected,
  generating = false,
  progress = null,
  onSelectAll,
  onDeselectAll,
  onGenerate,
}: BatchActionsProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
      <Checkbox
        checked={allSelected}
        onCheckedChange={(checked) => {
          if (checked) onSelectAll();
          else onDeselectAll();
        }}
      />
      <span className="text-sm text-muted-foreground">
        {selectedCount > 0
          ? `已选 ${selectedCount} / ${totalCount} 篇`
          : `共 ${totalCount} 篇`}
      </span>
      {selectedCount > 0 && (
        <>
          <Button size="sm" onClick={onGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Layers className="mr-1.5 h-4 w-4" />
            )}
            {generating ? "生成中..." : "批量生成素材卡"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeselectAll} disabled={generating}>
            <X className="mr-1 h-4 w-4" />
            取消选择
          </Button>
        </>
      )}
      {progress && (
        <span className="text-sm text-primary font-medium">{progress}</span>
      )}
    </div>
  );
}
