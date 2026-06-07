"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { translateSyncError } from "@/lib/error-messages";

interface SyncResult {
  success: boolean;
  syncRecordId?: string;
  error?: string;
}

interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    cardId: string;
    success: boolean;
    syncRecordId?: string;
    error?: string;
  }>;
}

interface SyncToImaProps {
  cardId: string;
  cardTitle?: string;
  confirmed?: boolean;
  onSyncComplete?: () => void;
  variant?: "icon" | "button" | "full";
}

export function SyncToIma({
  cardId,
  cardTitle: _cardTitle,
  confirmed = true,
  onSyncComplete,
  variant = "button",
}: SyncToImaProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const { isAdmin } = useAuth();

  // Only admins can sync to IMA
  if (!isAdmin) return null;

  async function handleSync() {
    setSyncing(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "同步失败");
      }

      const result: SyncResult = await res.json();
      setLastResult(result);
      onSyncComplete?.();
    } catch (error) {
      setLastResult({
        success: false,
        error: error instanceof Error ? error.message : "同步失败",
      });
    } finally {
      setSyncing(false);
    }
  }

  if (!confirmed) {
    if (variant === "icon") {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled
          title="请先确认素材卡"
        >
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>请先确认后再同步</span>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={syncing}
        onClick={handleSync}
        title={lastResult?.error ?? "同步到 ima"}
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={syncing}
        onClick={handleSync}
      >
        {syncing ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-4 w-4" />
        )}
        {syncing ? "同步中..." : "同步到 ima"}
      </Button>

      {lastResult && (
        <div className="flex items-center gap-2 text-xs">
          {lastResult.success ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <span className="text-green-600">同步成功</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive">{translateSyncError(lastResult.error)}</span>
            </>
          )}
        </div>
      )}

      {variant === "full" && lastResult?.success && lastResult.syncRecordId && (
        <SyncStatusCard syncRecordId={lastResult.syncRecordId} />
      )}
    </div>
  );
}

interface BatchSyncToImaProps {
  cardIds: string[];
  onSyncComplete?: () => void;
}

export function BatchSyncToIma({
  cardIds,
  onSyncComplete,
}: BatchSyncToImaProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<BatchSyncResult | null>(null);
  const { isAdmin } = useAuth();

  // Only admins can batch sync to IMA
  if (!isAdmin) return null;

  async function handleBatchSync() {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "批量同步失败");
      }

      const data: BatchSyncResult = await res.json();
      setResult(data);
      onSyncComplete?.();
    } catch (error) {
      setResult({
        total: cardIds.length,
        success: 0,
        failed: cardIds.length,
        results: cardIds.map((id) => ({
          cardId: id,
          success: false,
          error: error instanceof Error ? error.message : "同步失败",
        })),
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        disabled={syncing || cardIds.length === 0}
        onClick={handleBatchSync}
      >
        {syncing ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-4 w-4" />
        )}
        {syncing
          ? "同步中..."
          : `批量同步到 ima (${cardIds.length})`}
      </Button>

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>同步结果</span>
              <div className="flex gap-2">
                <Badge variant="default" className="text-xs bg-green-600">
                  成功 {result.success}
                </Badge>
                {result.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    失败 {result.failed}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          {result.failed > 0 && (
            <CardContent className="pt-0">
              <div className="space-y-1 max-h-32 overflow-auto">
                {result.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <div
                      key={r.cardId}
                      className="flex items-center gap-2 text-xs text-destructive"
                    >
                      <XCircle className="h-3 w-3 shrink-0" />
                      <span className="truncate">{translateSyncError(r.error)}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function SyncStatusCard({ syncRecordId }: { syncRecordId: string }) {
  const [record, setRecord] = useState<{
    id: string;
    status: string;
    targetRemoteId: string | null;
    remoteDocumentId: string | null;
    errorMessage: string | null;
    syncedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sync?syncRecordId=${syncRecordId}`);
      if (res.ok) {
        const data = await res.json();
        setRecord(data);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!record) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs"
        onClick={fetchStatus}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        查看详情
      </Button>
    );
  }

  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p>状态：{record.status === "success" ? "成功" : record.status === "failed" ? "失败" : "待同步"}</p>
      {record.remoteDocumentId && <p>文档 ID：{record.remoteDocumentId}</p>}
      {record.errorMessage && <p className="text-destructive">{translateSyncError(record.errorMessage)}</p>}
      <p>时间：{new Date(record.syncedAt).toLocaleString("zh-CN")}</p>
    </div>
  );
}
