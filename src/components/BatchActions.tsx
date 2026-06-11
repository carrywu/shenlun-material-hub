"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Loader2, X, Check, ShieldAlert, Ban } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface BatchActionsProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  generating?: boolean;
  reviewing?: boolean;
  progress?: string | null;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onGenerate: () => void;
  onReview?: (action: "approve" | "reject", opts?: { force?: boolean }) => void;
}

export function BatchActions({
  selectedCount,
  totalCount,
  allSelected,
  generating = false,
  reviewing = false,
  progress = null,
  onSelectAll,
  onDeselectAll,
  onGenerate,
  onReview,
}: BatchActionsProps) {
  const { isAdmin } = useAuth();
  const busy = generating || reviewing;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
      {isAdmin && (
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (checked) onSelectAll();
            else onDeselectAll();
          }}
        />
      )}
      <span className="text-sm text-muted-foreground">
        {selectedCount > 0
          ? `已选 ${selectedCount} / ${totalCount} 篇`
          : `共 ${totalCount} 篇`}
      </span>
      {isAdmin && selectedCount > 0 && (
        <>
          <Button size="sm" onClick={onGenerate} disabled={busy}>
            {generating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Layers className="mr-1.5 h-4 w-4" />
            )}
            {generating ? "生成中..." : "批量生成素材卡"}
          </Button>
          {onReview && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => onReview("approve")}
                disabled={busy}
                className="bg-green-600 hover:bg-green-600"
              >
                {reviewing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                审核通过
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReview("approve", { force: true })}
                disabled={busy}
                title="跳过 AI 评估要求，必须填写理由"
              >
                {reviewing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-1.5 h-4 w-4" />}
                强制通过
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReview("reject")}
                disabled={busy}
              >
                {reviewing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                拒绝
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onDeselectAll} disabled={busy}>
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
