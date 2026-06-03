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
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Rss,
} from "lucide-react";

interface StatusResult {
  success: boolean;
  baseUrl: string;
  reachable: boolean;
  feedCount?: number;
  message: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  created: number;
  updated: number;
  disabled: number;
  skipped: number;
  total: number;
}

interface FeedItem {
  id: string;
  name: string;
}

export default function WeweRssIntegrationPage() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:4000");
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/integrations/wewe-rss/status");
        const data = await res.json();
        setStatus(data);
        if (data.baseUrl) setBaseUrl(data.baseUrl);
      } catch {
        setStatus({
          success: false,
          baseUrl: "http://localhost:4000",
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
        setStatus({
          success: false,
          baseUrl,
          reachable: false,
          message: data.message,
        });
      }
    } catch {
      setStatus({
        success: false,
        baseUrl,
        reachable: false,
        message: "测试连接失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/wewe-rss/sync-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl }),
      });
      const data = await res.json();
      setSyncResult(data);
    } catch {
      setSyncResult({
        success: false,
        message: "同步失败",
        created: 0,
        updated: 0,
        disabled: 0,
        skipped: 0,
        total: 0,
      });
    } finally {
      setSyncing(false);
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
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="http://localhost:4000"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              测试连接
            </Button>
          </div>
          {status?.reachable && status.feedCount !== undefined && (
            <p className="text-sm text-muted-foreground mt-2">
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
            从 WeWe RSS 同步订阅的公众号到申论项目的来源列表
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing || !status?.reachable}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              同步公众号列表
            </Button>
            <Button variant="outline">
              <a
                href="http://localhost:4000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                打开 WeWe 后台
              </a>
            </Button>
          </div>
          {syncResult && (
            <div className="mt-3 p-3 rounded-md bg-muted">
              <p className="text-sm">{syncResult.message}</p>
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
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <span className="text-sm">{feed.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {feed.id}
                  </Badge>
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
          <p>2. 申论项目通过 HTTP 调用 WeWe RSS 获取订阅列表和 RSS 文章</p>
          <p>
            3. 点击&quot;刷新并采集&quot;时，会先请求 WeWe RSS
            更新 feed，再采集入库
          </p>
          <p>4. 所有数据保存在本地，不上传到外部服务</p>
        </CardContent>
      </Card>
    </div>
  );
}
