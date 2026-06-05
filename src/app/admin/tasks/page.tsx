"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface AsyncTaskItem {
  id: string;
  type: string;
  status: string;
  params: string | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskResponse {
  data: AsyncTaskItem[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "secondary",
  RUNNING: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
};

export default function AdminTasksPage() {
  const [data, setData] = useState<AsyncTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");

  async function fetchTasks(filters?: { status?: string; type?: string }) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "all") params.set("status", filters.status);
      if (filters?.type && filters.type !== "all") params.set("type", filters.type);
      const res = await fetch(`/api/admin/tasks?${params.toString()}`);
      const json: TaskResponse = await res.json();
      setData(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialTasks() {
      try {
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        if (type !== "all") params.set("type", type);
        const res = await fetch(`/api/admin/tasks?${params.toString()}`);
        const json: TaskResponse = await res.json();
        if (!cancelled) {
          setData(json.data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialTasks();

    return () => {
      cancelled = true;
    };
  }, [status, type]);

  useEffect(() => {
    if (!data.some((task) => task.status === "PENDING" || task.status === "RUNNING")) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchTasks({ status, type });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [data, status, type]);

  const filtered = data.filter((task) => {
    if (!query.trim()) return true;
    const haystack = [task.id, task.type, task.status, task.params ?? "", task.result ?? ""].join(" ");
    return haystack.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">异步任务</h2>
          <p className="text-xs text-[#a1a1aa] mt-1">查看采集、评估和素材卡任务执行状态</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchTasks({ status, type })}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="搜索 taskId / 参数 / 结果" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
            <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="RUNNING">RUNNING</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(value) => setType(value ?? "all")}>
            <SelectTrigger><SelectValue placeholder="类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="WEB_CRAWL">WEB_CRAWL</SelectItem>
              <SelectItem value="WEWE_RSS_SYNC">WEWE_RSS_SYNC</SelectItem>
              <SelectItem value="AI_ASSESS">AI_ASSESS</SelectItem>
              <SelectItem value="CARD_GENERATE">CARD_GENERATE</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载任务中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>完成时间</TableHead>
                  <TableHead>结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">{task.id}</TableCell>
                    <TableCell>{task.type}</TableCell>
                    <TableCell>
                      <Badge variant={(STATUS_COLORS[task.status] as "default" | "secondary" | "outline" | "destructive") ?? "secondary"}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(task.createdAt).toLocaleString("zh-CN")}</TableCell>
                    <TableCell>{task.completedAt ? new Date(task.completedAt).toLocaleString("zh-CN") : "-"}</TableCell>
                    <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground" title={task.result ?? task.params ?? ""}>
                      {task.result ?? task.params ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
