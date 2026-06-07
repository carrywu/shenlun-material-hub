"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCw,
  Calendar,
  Copy,
  Check,
} from "lucide-react";
import { SYNC_STATUSES, DOCUMENT_ROLES } from "@/types";
import { translateSyncError } from "@/lib/error-messages";

const STATUS_LABELS: Record<string, string> = {
  pending: "待同步",
  success: "成功",
  failed: "失败",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  success: CheckCircle2,
  failed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600",
  success: "text-green-600",
  failed: "text-destructive",
};

const DOC_ROLE_LABELS: Record<string, string> = {
  original_archive: "原文归档",
  material_card: "素材卡",
};

const CARD_TYPE_LABELS: Record<string, string> = {
  golden_sentence: "申论金句",
  standard_expression: "规范词",
  case_material: "案例素材",
  countermeasure: "对策表达",
  problem_statement: "问题表述",
  reason_analysis: "原因分析",
  policy_expression: "政策表述",
  data_fact: "案例素材",
  person_story: "人物事迹",
  article_structure: "文章框架",
  // Legacy fallback
  fact_summary: "案例素材",
  argument_analysis: "原因分析",
  data_highlight: "案例素材",
  policy_compare: "政策表述",
  case_study: "案例素材",
};

interface SyncRecordItem {
  id: string;
  materialCardId: string;
  contentItemId: string;
  documentRole: string;
  regionFolder: string | null;
  typeFolder: string | null;
  targetRemoteId: string | null;
  remoteDocumentId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  syncedAt: string;
  materialCard: {
    id: string;
    title: string;
    cardType: string;
    confirmed: boolean;
  };
}

interface SyncRecordsResponse {
  data: SyncRecordItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function SyncRecordsPage() {
  const [records, setRecords] = useState<SyncRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Retry state
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Copy state for remote document ID
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyRemoteId(recordId: string, remoteDocId: string) {
    try {
      await navigator.clipboard.writeText(remoteDocId);
      setCopiedId(recordId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (roleFilter !== "all") params.set("documentRole", roleFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", "20");

      const res = await fetch(`/api/sync-records?${params}`);
      if (!res.ok) throw new Error("查询失败");

      const data: SyncRecordsResponse = await res.json();
      setRecords(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
  }, [fetchRecords]);

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [statusFilter, roleFilter, dateFrom, dateTo]);

  async function handleRetry(record: SyncRecordItem) {
    if (!record.materialCard.confirmed) return;
    setRetryingId(record.id);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: record.materialCardId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "重试失败");
      }
      await fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重试失败");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">同步记录</h1>
            <p className="text-muted-foreground text-sm">
              查看素材卡同步到 ima 知识库的历史记录
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecords} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">状态</label>
            <Select value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v); }}>
              <SelectTrigger className="w-32" aria-label="同步状态">
                <SelectValue>
                  {statusFilter === "all" ? "全部" : (STATUS_LABELS[statusFilter] ?? statusFilter)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {SYNC_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">文档角色</label>
            <Select value={roleFilter} onValueChange={(v) => { if (v) setRoleFilter(v); }}>
              <SelectTrigger className="w-32" aria-label="文档角色">
                <SelectValue>
                  {roleFilter === "all" ? "全部" : (DOC_ROLE_LABELS[roleFilter] ?? roleFilter)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {DOCUMENT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {DOC_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">起始日期</label>
            <div className="relative w-40 h-8 group">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="absolute inset-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-input bg-transparent text-sm pointer-events-none group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50 transition-colors">
                <span className={dateFrom ? "text-foreground" : "text-muted-foreground"}>
                  {dateFrom || "年/月/日"}
                </span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">结束日期</label>
            <div className="relative w-40 h-8 group">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="absolute inset-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-input bg-transparent text-sm pointer-events-none group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50 transition-colors">
                <span className={dateTo ? "text-foreground" : "text-muted-foreground"}>
                  {dateTo || "年/月/日"}
                </span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>素材卡</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>文件夹</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>远端文档</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    暂无同步记录
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const StatusIcon = STATUS_ICONS[record.status] ?? Clock;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!record.materialCard.confirmed && (
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          )}
                          <span className="truncate max-w-48">{record.materialCard.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CARD_TYPE_LABELS[record.materialCard.cardType] ?? record.materialCard.cardType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {DOC_ROLE_LABELS[record.documentRole] ?? record.documentRole}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {record.regionFolder && <div>地区: {record.regionFolder}</div>}
                          {record.typeFolder && <div>类型: {record.typeFolder}</div>}
                          {!record.regionFolder && !record.typeFolder && <span>-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 ${STATUS_COLORS[record.status]}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span className="text-sm">{STATUS_LABELS[record.status]}</span>
                        </div>
                        {record.errorMessage && (
                          <div className="text-xs text-destructive mt-1 max-w-48 truncate" title={record.errorMessage}>
                            {translateSyncError(record.errorMessage)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.remoteDocumentId ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs text-muted-foreground truncate max-w-28">
                              {record.remoteDocumentId}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyRemoteId(record.id, record.remoteDocumentId!)}
                              className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                              title="复制远端文档 ID"
                            >
                              {copiedId === record.id ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(record.syncedAt).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        {record.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={retryingId === record.id || !record.materialCard.confirmed}
                            onClick={() => handleRetry(record)}
                            title={!record.materialCard.confirmed ? "素材卡未确认，无法重试" : "重试同步"}
                          >
                            {retryingId === record.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
