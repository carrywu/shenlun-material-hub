"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Database,
} from "lucide-react";

interface CleanPreview {
  delete_old_filtered: number;
  merge_duplicates: number;
  fix_urls: number;
  orphan_cards: number;
}

interface CleanResults {
  results: Record<string, number>;
  totalAffected: number;
  logs: string[];
}

const RULE_LABELS: Record<string, { label: string; description: string }> = {
  delete_old_filtered: {
    label: "清理过期过滤内容",
    description: "删除 processingStatus 为 filtered 且超过30天的内容",
  },
  merge_duplicates: {
    label: "合并重复内容",
    description: "基于 contentHash 去重，保留最新的记录",
  },
  fix_urls: {
    label: "修复异常 URL",
    description: "修复为空或格式异常的 URL 记录",
  },
  orphan_cards: {
    label: "清理孤立素材卡",
    description: "删除没有关联内容条目的孤立素材卡",
  },
};

export default function CleanPage() {
  const [preview, setPreview] = useState<CleanPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRules, setSelectedRules] = useState<Set<string>>(
    new Set(Object.keys(RULE_LABELS))
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState<CleanResults | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clean");
      if (!res.ok) throw new Error("请求失败");
      const data = await res.json();
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  function toggleRule(rule: string) {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(rule)) next.delete(rule);
      else next.add(rule);
      return next;
    });
  }

  async function handleClean() {
    setCleaning(true);
    try {
      const res = await fetch("/api/admin/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          rules: Array.from(selectedRules),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "清洗失败");
      }

      const data: CleanResults = await res.json();
      setResults(data);
      setShowConfirm(false);
      fetchPreview();
    } catch (err) {
      alert(err instanceof Error ? err.message : "数据清洗失败");
    } finally {
      setCleaning(false);
    }
  }

  const totalPreview =
    preview && selectedRules.size > 0
      ? Array.from(selectedRules).reduce(
          (sum, rule) => sum + (preview[rule as keyof CleanPreview] ?? 0),
          0
        )
      : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">数据清洗</h1>
            <p className="text-sm text-muted-foreground">
              清理过期、重复和异常数据，保持数据库整洁
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPreview}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {error ? (
          <div className="flex items-center justify-center h-48 text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : (
          <>
            {/* Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">清洗规则</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(RULE_LABELS).map(([rule, config]) => {
                  const count = preview?.[rule as keyof CleanPreview] ?? 0;
                  return (
                    <label
                      key={rule}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedRules.has(rule)}
                        onCheckedChange={() => toggleRule(rule)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {config.label}
                          </span>
                          <Badge
                            variant={count > 0 ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {count} 条
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        预计影响 {totalPreview} 条记录
                      </p>
                      <p className="text-xs text-muted-foreground">
                        已选择 {selectedRules.size} 个清洗规则
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={totalPreview === 0 || selectedRules.size === 0}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    执行清洗
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    清洗完成
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(results.results).map(([rule, count]) => (
                      <div key={rule} className="text-center">
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">
                          {RULE_LABELS[rule]?.label ?? rule}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-sm font-medium mb-1">清洗日志</p>
                    <div className="space-y-1">
                      {results.logs.map((log, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              确认数据清洗
            </DialogTitle>
            <DialogDescription>
              即将执行数据清洗，预计影响 {totalPreview} 条记录。
              此操作不可撤销，请确认是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleClean}
              disabled={cleaning}
            >
              {cleaning && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              确认清洗
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
