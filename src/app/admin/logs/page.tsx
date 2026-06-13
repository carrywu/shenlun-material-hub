"use client";

import { Fragment, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Trash2, AlertOctagon, AlertTriangle, Info, Search, ChevronDown, ChevronRight } from "lucide-react";

interface SystemLogItem {
  id: string;
  level: string;
  category: string;
  message: string;
  detail: string | null;
  createdAt: string;
}

interface LogsResponse {
  data: SystemLogItem[];
}

export default function AdminLogsPage() {
  const [data, setData] = useState<SystemLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function fetchLogs(filters?: { level?: string; category?: string; q?: string; dateFrom?: string; dateTo?: string }) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.level && filters.level !== "all") params.set("level", filters.level);
      if (filters?.category && filters.category !== "all") params.set("category", filters.category);
      if (filters?.q) params.set("q", filters.q);
      if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.set("dateTo", filters.dateTo);
      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const json: LogsResponse = await res.json();
      setData(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLogs() {
      try {
        const params = new URLSearchParams();
        if (level !== "all") params.set("level", level);
        if (category !== "all") params.set("category", category);
        if (q) params.set("q", q);
        const res = await fetch(`/api/admin/logs?${params.toString()}`);
        const json: LogsResponse = await res.json();
        if (!cancelled) {
          setData(json.data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialLogs();

    return () => {
      cancelled = true;
    };
  }, [level, category, q]);

  async function clearOldLogs() {
    setClearing(true);
    try {
      await fetch("/api/admin/logs?olderThanDays=30", { method: "DELETE" });
      await fetchLogs({ level, category });
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">系统日志</h2>
          <p className="text-xs text-muted-foreground mt-1">查看认证、AI、采集与备份相关日志</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchLogs({ level, category, q })}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            刷新
          </Button>
          <Button variant="destructive" size="sm" onClick={clearOldLogs} disabled={clearing}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            清理30天前日志
          </Button>
        </div>
      </div>

      {/* Error Level Stats — counted from loaded logs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">INFO</p>
            <p className="text-2xl font-bold text-blue-600">{data.filter((l) => l.level === "INFO").length}</p>
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">WARN</p>
            <p className="text-2xl font-bold text-amber-600">{data.filter((l) => l.level === "WARN").length}</p>
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertOctagon className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ERROR</p>
            <p className="text-2xl font-bold text-red-600">{data.filter((l) => l.level === "ERROR").length}</p>
          </div>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Search className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">采集日志 (CRAWLER)</p>
            <p className="text-2xl font-bold text-foreground">{data.filter((l) => l.category === "CRAWLER").length}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select value={level} onValueChange={(value) => setLevel(value ?? "all")}>
            <SelectTrigger aria-label="日志级别"><SelectValue placeholder="级别" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部级别</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(value) => setCategory(value ?? "all")}>
            <SelectTrigger aria-label="日志分类"><SelectValue placeholder="分类" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem value="SYSTEM">SYSTEM</SelectItem>
              <SelectItem value="CRAWLER">CRAWLER</SelectItem>
              <SelectItem value="AI">AI</SelectItem>
              <SelectItem value="AUTH">AUTH</SelectItem>
              <SelectItem value="BACKUP">BACKUP</SelectItem>
            </SelectContent>
          </Select>
          <form
            className="lg:col-span-1"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qInput.trim());
            }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="搜索来源/标题/URL"
                className="pl-8"
                aria-label="关键词搜索"
              />
            </div>
          </form>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="开始日期"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="结束日期"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载日志中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>级别</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>消息</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const hasDetail = !!log.detail;
                  return (
                    <Fragment key={log.id}>
                      <TableRow>
                        <TableCell>{new Date(log.createdAt).toLocaleString("zh-CN")}</TableCell>
                        <TableCell>
                          <Badge variant={log.level === "ERROR" ? "destructive" : log.level === "WARN" ? "secondary" : "outline"}>
                            {log.level}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.category}</TableCell>
                        <TableCell>{log.message}</TableCell>
                        <TableCell
                          className={`max-w-[360px] truncate text-xs text-muted-foreground ${hasDetail ? "cursor-pointer hover:text-foreground" : ""}`}
                          onClick={() => hasDetail && setExpandedId(isExpanded ? null : log.id)}
                        >
                          {hasDetail ? (
                            <span className="inline-flex items-center gap-1">
                              {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{log.detail}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasDetail && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <pre className="text-xs whitespace-pre-wrap break-all font-mono max-h-80 overflow-auto">
                              {log.detail}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
