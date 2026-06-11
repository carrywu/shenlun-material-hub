"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Globe,
  MessageSquare,
  Video,
  Camera,
} from "lucide-react";
import { waitForAdminTask } from "@/lib/client-admin-task";

interface SourceItem {
  id: string;
  name: string;
  platform: string;
  isEnabled: boolean;
  priority: string;
  lastCollectedAt: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  website: "网站",
  wechat: "微信",
  bilibili: "B站",
  xiaohongshu: "小红书",
};

const PLATFORM_ORDER = ["website", "wechat", "bilibili", "xiaohongshu"];

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  website: Globe,
  wechat: MessageSquare,
  bilibili: Video,
  xiaohongshu: Camera,
};

interface CollectResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  discoveredCount?: number;
  importedCount?: number;
  skippedCount?: number;
  blockedCount?: number;
  error?: string;
}

interface CollectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function CollectDialog({
  open,
  onOpenChange,
  onComplete,
}: CollectDialogProps) {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collecting, setCollecting] = useState(false);
  const [results, setResults] = useState<CollectResult[] | null>(null);
  const [intermediateResults, setIntermediateResults] = useState<CollectResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sources?pageSize=100&isEnabled=true");
      if (!res.ok) throw new Error("请求失败");
      const json = await res.json();
      setSources(json.data.filter((s: SourceItem) => s.isEnabled));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSources();
      setSelected(new Set());
      setResults(null);
      setCollecting(false);
    }
  }, [open, fetchSources]);

  // Group sources by platform
  const groupedSources = PLATFORM_ORDER.reduce(
    (acc, platform) => {
      const platformSources = sources.filter((s) => s.platform === platform);
      if (platformSources.length > 0) {
        acc.push({ platform, sources: platformSources });
      }
      return acc;
    },
    [] as { platform: string; sources: SourceItem[] }[]
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(sources.map((s) => s.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleCollect() {
    if (selected.size === 0) return;

    const selectedSources = sources.filter((s) => selected.has(s.id));
    const mediaCrawlerSources = selectedSources.filter(
      (s) => s.platform === "bilibili" || s.platform === "xiaohongshu"
    );

    if (mediaCrawlerSources.length > 0) {
      toast.warning("B站/小红书 采集前置提示", {
        description:
          `${mediaCrawlerSources.map((s) => s.name).join("、")} 依赖 MediaCrawler 外部服务（默认端口 8002），请确认服务已运行，否则采集将直接失败。`,
        duration: 6000,
      });
    }

    setCollecting(true);
    setResults(null);
    setIntermediateResults([]);
    setTotalCount(selectedSources.length);
    setCurrentIndex(0);

    const allResults: CollectResult[] = [];

    for (let i = 0; i < selectedSources.length; i++) {
      const source = selectedSources[i];
      setCurrentIndex(i + 1);

      try {
        // Determine the API endpoint based on platform
        let apiEndpoint: string;
        let body: Record<string, string>;

        if (source.platform === "wechat") {
          apiEndpoint = "/api/collectors/wechat/sync";
          body = { sourceId: source.id };
        } else if (
          source.platform === "bilibili" ||
          source.platform === "xiaohongshu"
        ) {
          apiEndpoint = "/api/collectors/mediacrawler/crawl";
          body = {
            platform: source.platform,
            userId: source.id,
          };
        } else {
          apiEndpoint = "/api/collectors/web/collect";
          body = { sourceId: source.id };
        }

        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (data.taskId) {
          const task = await waitForAdminTask(data.taskId);
          const result = task.result ? JSON.parse(task.result) : null;
          if (task.status === "FAILED") {
            throw new Error(result?.message ?? data.error ?? "采集失败");
          }
          allResults.push({
            sourceId: source.id,
            sourceName: source.name,
            success: true,
            discoveredCount: result?.discoveredCount,
            importedCount: result?.importedCount,
            skippedCount: result?.skippedCount,
            blockedCount: result?.blockedCount,
            error: undefined,
          });
          setIntermediateResults([...allResults]);
          continue;
        }

        allResults.push({
          sourceId: source.id,
          sourceName: source.name,
          success: data.success ?? res.ok,
          discoveredCount: data.discoveredCount,
          importedCount: data.importedCount,
          skippedCount: data.skippedCount,
          blockedCount: data.blockedCount,
          error: data.error,
        });
      } catch (err) {
        allResults.push({
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          error: err instanceof Error ? err.message : "采集失败",
        });
      }

      setIntermediateResults([...allResults]);
    }

    setResults(allResults);
    setCollecting(false);
    onComplete?.();
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;
  const totalImported =
    results?.reduce((sum, r) => sum + (r.importedCount ?? 0), 0) ?? 0;
  const totalSkipped =
    results?.reduce((sum, r) => sum + (r.skippedCount ?? 0), 0) ?? 0;
  const totalBlocked =
    results?.reduce((sum, r) => sum + (r.blockedCount ?? 0), 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>开始采集</DialogTitle>
          <DialogDescription>
            {results
              ? "采集完成"
              : "选择要采集的来源，点击开始采集"}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          /* Results view */
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{successCount} 成功</span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">{failCount} 失败</span>
                </div>
              )}
              {totalBlocked > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">{totalBlocked} 封禁</span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                共导入 {totalImported} 条
                {totalSkipped > 0 && `，跳过 ${totalSkipped} 条`}
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-auto">
              {results.map((r) => (
                <div
                  key={r.sourceId}
                  className="flex items-center justify-between rounded-md border p-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {r.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium">{r.sourceName}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {r.success
                      ? `发现 ${r.discoveredCount ?? 0}，导入 ${r.importedCount ?? 0}${(r.blockedCount ?? 0) > 0 ? `，封禁 ${r.blockedCount}` : ""}${(r.skippedCount ?? 0) > 0 ? `，跳过 ${r.skippedCount}` : ""}`
                      : r.error ?? "失败"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : collecting ? (
          /* Collecting progress */
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">
                正在采集 ({currentIndex} / {totalCount})...
              </span>
            </div>
            {intermediateResults.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-auto">
                {intermediateResults.map((r) => (
                  <div
                    key={r.sourceId}
                    className="flex items-center gap-2 rounded-md border p-2 text-xs"
                  >
                    {r.success ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span>{r.sourceName}</span>
                    <span className="text-muted-foreground ml-auto">
                      {r.success
                        ? `+${r.importedCount ?? 0}`
                        : r.error ?? "失败"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载来源...
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <p>没有已启用的来源</p>
            <p className="text-sm">请先在来源管理中启用来源</p>
          </div>
        ) : (
          /* Source selection */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                已选 {selected.size} / {sources.length} 个来源
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="xs" onClick={selectAll}>
                  全选
                </Button>
                <Button variant="ghost" size="xs" onClick={deselectAll}>
                  取消全选
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-auto">
              {groupedSources.map(({ platform, sources: platformSources }) => {
                const Icon = PLATFORM_ICONS[platform] ?? Globe;
                const allPlatformSelected = platformSources.every((s) =>
                  selected.has(s.id)
                );
                return (
                  <div key={platform}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {PLATFORM_LABELS[platform] ?? platform}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {platformSources.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="ml-auto text-xs"
                        onClick={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (allPlatformSelected) {
                              platformSources.forEach((s) => next.delete(s.id));
                            } else {
                              platformSources.forEach((s) => next.add(s.id));
                            }
                            return next;
                          });
                        }}
                      >
                        {allPlatformSelected ? "取消" : "全选"}
                      </Button>
                    </div>
                    <div className="space-y-1 pl-6">
                      {platformSources.map((source) => (
                        <label
                          key={source.id}
                          className="flex items-center gap-2.5 rounded-md p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selected.has(source.id)}
                            onCheckedChange={() => toggleSelect(source.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">
                              {source.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge
                                variant={
                                  source.priority === "P0"
                                    ? "destructive"
                                    : source.priority === "P1"
                                      ? "default"
                                      : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {source.priority}
                              </Badge>
                              {source.lastCollectedAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  上次采集:{" "}
                                  {new Date(
                                    source.lastCollectedAt
                                  ).toLocaleDateString("zh-CN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => onOpenChange(false)}>完成</Button>
          ) : collecting ? (
            <Button disabled>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              采集中...
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleCollect}
                disabled={selected.size === 0}
              >
                <Play className="mr-1.5 h-4 w-4" />
                开始采集 ({selected.size})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
