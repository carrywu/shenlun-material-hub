"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Globe,
  ListTodo,
  AlertOctagon,
  RefreshCw,
  HardDrive,
  Cpu,
  Layers,
  ChevronRight,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TASK_TYPE_LABELS: Record<string, string> = {
  WEB_CRAWL: "网页爬取",
  WEWE_RSS_SYNC: "微信RSS同步",
  AI_ASSESS: "AI评估",
  CARD_GENERATE: "卡片生成",
};

const LOG_CATEGORY_LABELS: Record<string, string> = {
  CRAWLER: "采集器",
  AI: "AI服务",
  SYSTEM: "系统",
  AUTH: "认证",
  BACKUP: "备份",
};

interface MetricsData {
  dbStats: {
    totalArticles: number;
    totalSources: number;
    activeTasks: number;
    failedTasks24h: number;
    errorLogs24h: number;
    dbSizeMb: number;
  };
  systemStats: {
    memory: { total: number; used: number; percent: number };
    cpu: { percent: number; cores: number };
    disk: { percent: number; freeGb: number };
    os: string;
  };
  recentErrors: Array<{
    id: string;
    level: string;
    category: string;
    message: string;
    createdAt: string;
  }>;
  recentTasks: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/metrics");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load dashboard metrics", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/metrics")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch admin metrics");
        }
        return res.json();
      })
      .then((json: MetricsData) => {
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Failed to load dashboard metrics", e);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card rounded-xl border border-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-card rounded-xl border border-border" />
          <div className="h-64 bg-card rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 border border-border rounded-xl bg-card">
        <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-base font-semibold text-foreground">无法加载系统数据</h3>
        <p className="text-xs text-muted-foreground mt-1">请检查后台服务或刷新重试</p>
        <Button
          size="sm"
          onClick={fetchMetrics}
        >
          重新尝试
        </Button>
      </div>
    );
  }

  const { dbStats, systemStats, recentErrors = [], recentTasks = [] } = data;

  const cardStats = [
    {
      title: "文章总量",
      value: dbStats.totalArticles,
      desc: `数据库占用 ${dbStats.dbSizeMb} MB`,
      icon: FileText,
      color: "from-blue-500 to-indigo-500",
      link: "/admin/articles"
    },
    {
      title: "信息来源",
      value: dbStats.totalSources,
      desc: "涵盖网站与微信公众号",
      icon: Globe,
      color: "from-emerald-500 to-teal-500",
      link: "/admin/sources"
    },
    {
      title: "活动中任务",
      value: dbStats.activeTasks,
      desc: "后台同步/爬取任务数",
      icon: ListTodo,
      color: "from-amber-500 to-orange-500",
      link: "/admin/tasks"
    },
    {
      title: "24h 失败任务",
      value: dbStats.failedTasks24h,
      desc: "近 24 小时失败任务数",
      icon: AlertOctagon,
      color: "from-orange-500 to-red-500",
      textColor: dbStats.failedTasks24h > 0 ? "text-red-600" : "text-foreground",
      link: "/admin/tasks"
    },
    {
      title: "24h 错误日志",
      value: dbStats.errorLogs24h,
      desc: "近 24 小时系统报错次数",
      icon: AlertOctagon,
      color: "from-rose-500 to-red-500",
      textColor: dbStats.errorLogs24h > 0 ? "text-red-600" : "text-foreground",
      link: "/admin/logs"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">控制台概览</h2>
          <p className="text-xs text-muted-foreground mt-1">运行状态监控与模块配置中心</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "刷新中" : "手动刷新"}</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cardStats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.link}
              className="p-6 bg-card hover:bg-muted border border-border hover:border-primary/20 rounded-xl transition-all duration-300 group flex items-start justify-between cursor-pointer"
            >
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground font-medium">{card.title}</span>
                <div className={`text-2xl font-bold tracking-tight ${card.textColor || "text-foreground"}`}>
                  {card.value}
                </div>
                <p className="text-[10px] text-muted-foreground">{card.desc}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white opacity-90 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                <Icon className="w-5 h-5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* System Resource Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Hardware Status */}
        <div className="p-6 bg-card border border-border rounded-xl space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span>硬件运行环境</span>
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">当前机器性能指标</p>
          </div>

          <div className="space-y-4">
            {/* CPU */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">处理器负载</span>
                <span className="text-foreground font-medium">{systemStats.cpu.percent}% ({systemStats.cpu.cores}核)</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    systemStats.cpu.percent > 80 ? "bg-red-500" : systemStats.cpu.percent > 50 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(systemStats.cpu.percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">内存占用</span>
                <span className="text-foreground font-medium">{systemStats.memory.used} / {systemStats.memory.total} MB ({systemStats.memory.percent}%)</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${systemStats.memory.percent}%` }}
                />
              </div>
            </div>

            {/* Disk */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">磁盘剩余空间</span>
                <span className="text-foreground font-medium">剩余 {systemStats.disk.freeGb.toFixed(1)} GB ({100 - systemStats.disk.percent}%)</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${systemStats.disk.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate" title={systemStats.os}>{systemStats.os}</span>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="p-6 bg-card border border-border rounded-xl space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>最近执行任务</span>
            </h3>
            <Link href="/admin/tasks" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 transition cursor-pointer">
              <span>全部任务</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              当前没有执行过的异步任务
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务类型</TableHead>
                  <TableHead>触发时间</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono font-medium text-xs text-primary">
                      {TASK_TYPE_LABELS[task.type] || task.type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{new Date(task.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        task.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : task.status === "FAILED"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : task.status === "RUNNING"
                          ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {task.status === "COMPLETED" ? "成功" : task.status === "FAILED" ? "失败" : task.status === "RUNNING" ? "运行中" : "排队中"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

      </div>

      {/* Recent System Errors */}
      <div className="p-6 bg-card border border-border rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            <span>最近系统异常</span>
          </h3>
          <Link href="/admin/logs" className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 transition cursor-pointer">
            <span>日志中心</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentErrors.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            系统运行平稳，最近无报错日志 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {recentErrors.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-red-50/50 border border-red-100 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-red-200 transition-all duration-200"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">
                      {LOG_CATEGORY_LABELS[log.category] || log.category}
                    </span>
                    <span className="text-xs font-medium text-foreground">{log.message}</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("zh-CN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
