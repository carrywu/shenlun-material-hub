"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  X,
  Rss,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface Subscription {
  id: string;
  sourceId: string;
  sourceName: string;
  feedId: string | null;
  mpName: string | null;
  status: string;
  lastSyncAt: string | null;
  articleCount: number;
  createdAt: string;
}

interface AvailableSource {
  id: string;
  name: string;
  feedId: string | null;
}

export default function UserSubscriptionsPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const isVerified = isAdmin || user?.role === "VERIFIED_USER";

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [available, setAvailable] = useState<AvailableSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);

  async function fetchSubscriptions() {
    try {
      const res = await fetch("/api/user/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch {
      console.error("加载订阅列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableSources() {
    try {
      // 获取所有 wewe-rss source
      const res = await fetch("/api/sources?provider=wewe-rss");
      if (res.ok) {
        const data = await res.json();
        const sources = (data.sources || data.items || data || []) as AvailableSource[];
        // 过滤掉已订阅的
        const subIds = new Set(subscriptions.map((s) => s.sourceId));
        setAvailable(sources.filter((s: AvailableSource) => !subIds.has(s.id)));
        setShowAvailable(true);
      }
    } catch {
      toast.error("加载可用公众号失败");
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/user/subscriptions/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        void fetchSubscriptions();
      } else {
        toast.error(data.error || "同步失败");
      }
    } catch {
      toast.error("同步失败");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubscribe(sourceId: string, mpName?: string) {
    try {
      const res = await fetch("/api/user/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, mpName }),
      });
      if (res.ok || res.status === 201) {
        toast.success("订阅成功");
        void fetchSubscriptions();
        // 刷新可用列表
        const subIds = new Set(subscriptions.map((s) => s.sourceId));
        subIds.add(sourceId);
        setAvailable((prev) => prev.filter((s) => s.id !== sourceId));
      } else {
        const data = await res.json();
        toast.error(data.error || "订阅失败");
      }
    } catch {
      toast.error("订阅失败");
    }
  }

  async function handleUnsubscribe(sourceId: string) {
    try {
      const res = await fetch(`/api/user/subscriptions?sourceId=${sourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("已取消订阅");
        void fetchSubscriptions();
      } else {
        toast.error("取消订阅失败");
      }
    } catch {
      toast.error("取消订阅失败");
    }
  }

  useEffect(() => {
    if (user && isVerified) {
      void fetchSubscriptions();
    }
  }, [user, isVerified]);

  if (!user || !isVerified) {
    router.push("/settings");
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Rss className="h-5 w-5" />
              我的订阅
            </h1>
            <p className="text-sm text-muted-foreground">
              管理你关注的微信公众号，只展示你订阅的文章
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              同步公众号
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAvailableSources}>
              <Plus className="h-4 w-4 mr-1" />
              添加订阅
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 当前订阅 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              已订阅的公众号 ({subscriptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                你还没有订阅任何公众号。点击"同步公众号"从 WeWe RSS 获取列表，然后点击"添加订阅"关注你感兴趣的公众号。
              </p>
            ) : (
              <div className="space-y-2">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{sub.mpName || sub.sourceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.articleCount > 0 ? `${sub.articleCount} 篇文章` : "暂无文章"}
                        {sub.lastSyncAt && ` · 上次同步 ${new Date(sub.lastSyncAt).toLocaleDateString("zh-CN")}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnsubscribe(sub.sourceId)}
                    >
                      <X className="h-4 w-4 mr-1" /> 取消订阅
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 可用公众号列表 */}
        {showAvailable && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">可订阅的公众号</CardTitle>
            </CardHeader>
            <CardContent>
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  没有新的公众号可以订阅。请先点击"同步公众号"获取最新列表。
                </p>
              ) : (
                <div className="space-y-2">
                  {available.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <p className="font-medium">{source.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSubscribe(source.id, source.name)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> 订阅
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
