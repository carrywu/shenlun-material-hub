"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, User } from "lucide-react";

interface AsyncTaskItem {
  id: string;
  type: string;
  status: string;
  params: string | null;
  result: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskResponse {
  data: AsyncTaskItem[];
  total: number;
}

interface UserOption {
  id: string;
  username: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "secondary",
  RUNNING: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  WEB_CRAWL: "网页爬取",
  WEWE_RSS_SYNC: "微信RSS同步",
  AI_ASSESS: "AI评估",
  CARD_GENERATE: "卡片生成",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "排队中",
  RUNNING: "运行中",
  COMPLETED: "已完成",
  FAILED: "失败",
};

/** Safe JSON parse — returns original string if invalid */
function safeJsonParse(str: string | null): string {
  if (!str) return "-";
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed);
  } catch {
    return str;
  }
}

/** Truncate result for table display */
function truncateResult(str: string | null, maxLen = 120): string {
  if (!str) return "-";
  try {
    const parsed = JSON.parse(str);
    const flat = typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed);
    return flat.length > maxLen ? flat.slice(0, maxLen) + "…" : flat;
  } catch {
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
  }
}

export default function AdminTasksPage() {
  const [data, setData] = useState<AsyncTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  async function fetchTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (type !== "all") params.set("type", type);
      if (selectedUserId !== "all") params.set("userId", selectedUserId);
      const res = await fetch(`/api/admin/tasks?${params.toString()}`);
      const json: TaskResponse = await res.json();
      setData(json.data);
    } finally {
      setLoading(false);
    }
  }

  // Load user list for filter dropdown
  useEffect(() => {
    fetch("/api/admin/users?pageSize=500")
      .then((r) => r.json())
      .then((json) => {
        const items: UserOption[] = (json.data ?? json).map((u: { id: string; username: string }) => ({
          id: u.id,
          username: u.username,
        }));
        setUsers(items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialTasks() {
      try {
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        if (type !== "all") params.set("type", type);
        if (selectedUserId !== "all") params.set("userId", selectedUserId);
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
  }, [status, type, selectedUserId]);

  useEffect(() => {
    if (!data.some((task) => task.status === "PENDING" || task.status === "RUNNING")) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchTasks();
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, status, type, selectedUserId]);

  const filtered = data.filter((task) => {
    if (!query.trim()) return true;
    const haystack = [task.id, task.type, task.status, task.params ?? "", task.result ?? ""].join(" ");
    return haystack.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">异步任务</h2>
          <p className="text-xs text-muted-foreground mt-1">查看采集、评估和素材卡任务执行状态</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchTasks()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="搜索 taskId / 参数 / 结果" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
            <SelectTrigger aria-label="任务状态"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="PENDING">排队中</SelectItem>
              <SelectItem value="RUNNING">运行中</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
              <SelectItem value="FAILED">失败</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(value) => setType(value ?? "all")}>
            <SelectTrigger aria-label="任务类型"><SelectValue placeholder="类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="WEB_CRAWL">网页爬取</SelectItem>
              <SelectItem value="WEWE_RSS_SYNC">微信RSS同步</SelectItem>
              <SelectItem value="AI_ASSESS">AI评估</SelectItem>
              <SelectItem value="CARD_GENERATE">卡片生成</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedUserId} onValueChange={(value) => setSelectedUserId(value ?? "all")}>
            <SelectTrigger aria-label="发起用户"><SelectValue placeholder="发起用户" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部用户</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    {u.username}
                  </span>
                </SelectItem>
              ))}
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
                  <>
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    >
                      <TableCell className="font-mono text-xs">{task.id}</TableCell>
                      <TableCell>{TASK_TYPE_LABELS[task.type] || task.type}</TableCell>
                      <TableCell>
                        <Badge variant={(STATUS_COLORS[task.status] as "default" | "secondary" | "outline" | "destructive") ?? "secondary"}>
                          {STATUS_LABELS[task.status] || task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(task.createdAt).toLocaleString("zh-CN")}</TableCell>
                      <TableCell>{task.completedAt ? new Date(task.completedAt).toLocaleString("zh-CN") : "-"}</TableCell>
                      <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground" title={safeJsonParse(task.result)}>
                        {truncateResult(task.result ?? task.params)}
                      </TableCell>
                    </TableRow>
                    {expandedTask === task.id && (
                      <TableRow key={`${task.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="space-y-2 p-3">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">任务参数</p>
                              <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-40">
                                {safeJsonParse(task.params)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">执行结果</p>
                              <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-60">
                                {safeJsonParse(task.result)}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
