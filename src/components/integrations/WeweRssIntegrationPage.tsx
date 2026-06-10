"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Rss,
  Trash2,
  Eye,
} from "lucide-react";

interface StatusResult {
  success: boolean;
  baseUrl: string;
  publicUrl?: string | null;
  publicConfigured?: boolean;
  reachable: boolean;
  feedCount?: number;
  message: string;
  code?: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  syncSource?: string;
  created: number;
  updated: number;
  skipped: number;
  toDelete: Array<{ id: string; feedId: string; name: string }>;
  total: number;
}

interface PreviewResult {
  success: boolean;
  source: string;
  message: string;
  toCreate: Array<{ feedId: string; name: string; feedUrl: string }>;
  toUpdate: Array<{ feedId: string; name: string; oldName: string }>;
  toDelete: Array<{ feedId: string; name: string; id: string }>;
  total: number;
}

interface FeedItem {
  id: string;
  name: string;
}

export default function WeweRssIntegrationPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState("infra/wechat-rss/wewe-rss/data/wewe-rss.db");
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Array<{ id: string; feedId: string; name: string }>>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/integrations/wewe-rss/status");
        const data = await res.json();
        setStatus(data);
        if (data.baseUrl) setBaseUrl(data.baseUrl);
        if (data.publicUrl) setPublicUrl(data.publicUrl);
      } catch {
        setStatus({
          success: false,
          baseUrl: "",
          reachable: false,
          message: "检查状态失败",
        });
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/wewe-rss/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setFeeds(data.feeds ?? []);
        setStatus({
          success: true,
          baseUrl,
          reachable: true,
          feedCount: data.feedCount,
          message: data.message,
        });
      } else {
        setStatus({ success: false, baseUrl, reachable: false, message: data.message });
      }
    } catch {
      setStatus({ success: false, baseUrl, reachable: false, message: "测试连接失败" });
    } finally {
      setTesting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/integrations/wewe-rss/preview-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, dbPath }),
      });
      const data = await res.json();
      setPreviewResult(data);
    } catch {
      setPreviewResult(null);
      alert("预览失败");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/wewe-rss/sync-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, dbPath }),
      });
      const data = await res.json();
      setSyncResult(data);

      // 如果有待删除来源，弹出确认框
      if (data.toDelete && data.toDelete.length > 0) {
        setPendingDelete(data.toDelete);
        setDeleteDialogOpen(true);
      }
    } catch {
      setSyncResult({ success: false, message: "同步失败", created: 0, updated: 0, skipped: 0, toDelete: [], total: 0 });
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/integrations/wewe-rss/delete-missing-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceIds: pendingDelete.map((d) => d.id),
          deleteContentItems: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`已删除 ${data.deleted} 个来源（已入库文章未删除）`);
        setPendingDelete([]);
        // 刷新同步结果
        handleSync();
      } else {
        alert(data.error ?? "删除失败");
      }
    } catch {
      alert("删除失败");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Rss className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">WeWe RSS 集成</h1>
          <p className="text-sm text-muted-foreground">
            管理本地 WeWe RSS 服务连接，同步公众号列表
          </p>
        </div>
      </div>

      {/* 连接状态 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            连接状态
            {status?.reachable ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" /> 已连接
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" /> 未连接
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{status?.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="WEWERSS_BASE_URL，例如 http://wewerss:4000"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              测试连接
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="infra/wechat-rss/wewe-rss/data/wewe-rss.db"
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              className="flex-1"
            />
          </div>
          {status?.reachable && status.feedCount !== undefined && (
            <p className="text-sm text-muted-foreground">
              已订阅 {status.feedCount} 个公众号
            </p>
          )}
        </CardContent>
      </Card>

      {/* 同步操作 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>同步公众号列表</CardTitle>
          <CardDescription>
            从 WeWe RSS 同步订阅的公众号到申论项目的来源列表。优先使用 API，SQLite 只读兜底。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handlePreview} disabled={previewing} variant="outline">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              预览同步
            </Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              同步公众号列表
            </Button>
            <Button variant="outline" disabled={!publicUrl}>
              <a
                href={publicUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
                onClick={(event) => {
                  if (!publicUrl) {
                    event.preventDefault();
                    alert("未配置 WeWeRSS 公网访问地址");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                打开 WeWe 后台
              </a>
            </Button>
          </div>

          {/* 预览结果 */}
          {previewResult && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium">{previewResult.message}（数据来源：{previewResult.source}）</p>
              {previewResult.toCreate.length > 0 && (
                <div>
                  <p className="text-sm text-green-600 font-medium">将创建 ({previewResult.toCreate.length})</p>
                  {previewResult.toCreate.map((f) => (
                    <p key={f.feedId} className="text-sm text-muted-foreground ml-2">+ {f.name}</p>
                  ))}
                </div>
              )}
              {previewResult.toUpdate.length > 0 && (
                <div>
                  <p className="text-sm text-blue-600 font-medium">将更新 ({previewResult.toUpdate.length})</p>
                  {previewResult.toUpdate.map((f) => (
                    <p key={f.feedId} className="text-sm text-muted-foreground ml-2">↻ {f.oldName} → {f.name}</p>
                  ))}
                </div>
              )}
              {previewResult.toDelete.length > 0 && (
                <div>
                  <p className="text-sm text-red-600 font-medium">待删除 ({previewResult.toDelete.length})</p>
                  {previewResult.toDelete.map((f) => (
                    <p key={f.feedId} className="text-sm text-muted-foreground ml-2">- {f.name}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 同步结果 */}
          {syncResult && (
            <div className="mt-3 p-3 rounded-md bg-muted">
              <p className="text-sm">{syncResult.message}</p>
              {syncResult.syncSource && (
                <p className="text-xs text-muted-foreground mt-1">数据来源：{syncResult.syncSource}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已发现的 feeds */}
      {feeds.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>WeWe RSS 中的公众号</CardTitle>
            <CardDescription>
              以下公众号已通过测试连接发现，点击&quot;同步&quot;可导入为来源
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feeds.map((feed) => (
                <div key={feed.id} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm">{feed.name}</span>
                  <Badge variant="outline" className="text-xs">{feed.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle>工作原理</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. WeWe RSS 是独立的 Docker 服务，负责微信读书登录和公众号订阅</p>
          <p>2. 申论项目通过 HTTP API 或 SQLite 只读方式获取订阅列表</p>
          <p>3. 点击&quot;刷新并采集&quot;时，会先请求 WeWe RSS 更新 feed，再采集入库</p>
          <p>4. 同步时发现 WeWe RSS 已删除的公众号，会提示确认后再删除</p>
          <p>5. 手动添加的来源不会被同步删除</p>
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>同步删除来源确认</DialogTitle>
            <DialogDescription>
              检测到 WeWe RSS 中已删除以下公众号。是否同步删除申论项目中的对应来源？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pendingDelete.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded border">
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="text-sm">{d.name}</span>
                <Badge variant="outline" className="text-xs">{d.feedId}</Badge>
              </div>
            ))}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>注意：</p>
            <p>1. 只会删除 WeWe RSS 同步来的来源</p>
            <p>2. 不会删除你手动添加的来源</p>
            <p>3. 默认不会删除已入库文章</p>
            <p>4. 删除后可通过重新同步恢复仍存在于 WeWe RSS 的来源</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确认删除（不删文章）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
