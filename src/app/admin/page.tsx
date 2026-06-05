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

interface MetricsData {
  dbStats: {
    totalArticles: number;
    totalSources: number;
    activeTasks: number;
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
        <div className="h-10 w-48 bg-[#18181b] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-[#18181b] rounded-xl border border-[#27272a]/60" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-[#18181b] rounded-xl border border-[#27272a]/60" />
          <div className="h-64 bg-[#18181b] rounded-xl border border-[#27272a]/60" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 border border-[#27272a] rounded-xl bg-[#18181b]/30">
        <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-base font-semibold text-white">无法加载系统数据</h3>
        <p className="text-xs text-[#a1a1aa] mt-1">请检查后台服务或刷新重试</p>
        <button 
          onClick={fetchMetrics}
          className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-medium transition cursor-pointer"
        >
          重新尝试
        </button>
      </div>
    );
  }

  const { dbStats, systemStats, recentErrors, recentTasks } = data;

  const cardStats = [
    {
      title: "文章总量",
      value: dbStats.totalArticles,
      desc: `数据库占用 ${dbStats.dbSizeMb} MB`,
      icon: FileText,
      color: "from-blue-600 to-indigo-600",
      link: "/admin/articles"
    },
    {
      title: "信息来源",
      value: dbStats.totalSources,
      desc: "涵盖网站与微信公众号",
      icon: Globe,
      color: "from-emerald-600 to-teal-600",
      link: "/admin/sources"
    },
    {
      title: "活动中任务",
      value: dbStats.activeTasks,
      desc: "后台同步/爬取任务数",
      icon: ListTodo,
      color: "from-amber-600 to-orange-600",
      link: "/admin/tasks"
    },
    {
      title: "今日错误日志",
      value: dbStats.errorLogs24h,
      desc: "近 24 小时系统报错次数",
      icon: AlertOctagon,
      color: "from-rose-600 to-red-600",
      textColor: dbStats.errorLogs24h > 0 ? "text-rose-400" : "text-[#f4f4f5]",
      link: "/admin/logs"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">控制台概览</h2>
          <p className="text-xs text-[#a1a1aa] mt-1">运行状态监控与模块配置中心</p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#27272a] bg-[#18181b]/40 hover:bg-[#18181b]/90 text-xs font-medium transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-violet-400" : ""}`} />
          <span>{refreshing ? "刷新中" : "手动刷新"}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cardStats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link 
              key={idx} 
              href={card.link}
              className="p-6 bg-[#18181b]/30 hover:bg-[#18181b]/60 border border-[#27272a]/60 hover:border-violet-500/20 rounded-xl transition-all duration-300 group flex items-start justify-between cursor-pointer"
            >
              <div className="space-y-2">
                <span className="text-xs text-[#a1a1aa] font-medium">{card.title}</span>
                <div className={`text-2xl font-bold tracking-tight ${card.textColor || "text-white"}`}>
                  {card.value}
                </div>
                <p className="text-[10px] text-[#71717a]">{card.desc}</p>
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
        <div className="p-6 bg-[#18181b]/30 border border-[#27272a]/60 rounded-xl space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              <span>硬件运行环境</span>
            </h3>
            <p className="text-[10px] text-[#71717a] mt-1">当前机器性能指标</p>
          </div>

          <div className="space-y-4">
            {/* CPU */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">处理器负载</span>
                <span className="text-white font-medium">{systemStats.cpu.percent}% ({systemStats.cpu.cores}核)</span>
              </div>
              <div className="h-1.5 w-full bg-[#27272a] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    systemStats.cpu.percent > 80 ? "bg-red-500" : systemStats.cpu.percent > 50 ? "bg-amber-500" : "bg-violet-500"
                  }`}
                  style={{ width: `${Math.min(systemStats.cpu.percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">内存占用</span>
                <span className="text-white font-medium">{systemStats.memory.used} / {systemStats.memory.total} MB ({systemStats.memory.percent}%)</span>
              </div>
              <div className="h-1.5 w-full bg-[#27272a] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${systemStats.memory.percent}%` }}
                />
              </div>
            </div>

            {/* Disk */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">磁盘剩余空间</span>
                <span className="text-white font-medium">剩余 {systemStats.disk.freeGb.toFixed(1)} GB ({100 - systemStats.disk.percent}%)</span>
              </div>
              <div className="h-1.5 w-full bg-[#27272a] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${systemStats.disk.percent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#27272a]/60 text-[10px] text-[#71717a] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#71717a]" />
            <span className="truncate" title={systemStats.os}>{systemStats.os}</span>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="p-6 bg-[#18181b]/30 border border-[#27272a]/60 rounded-xl space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>最近执行任务</span>
            </h3>
            <Link href="/admin" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition cursor-pointer">
              <span>全部任务</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#71717a]">
              当前没有执行过的异步任务
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#27272a] text-[#71717a]">
                    <th className="py-2 font-medium">任务类型</th>
                    <th className="py-2 font-medium">触发时间</th>
                    <th className="py-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]/40 text-[#d4d4d8]">
                  {recentTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-[#18181b]/20">
                      <td className="py-3 font-mono font-medium text-xs text-violet-300">
                        {task.type}
                      </td>
                      <td className="py-3 text-[#a1a1aa] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#71717a]" />
                        <span>{new Date(task.createdAt).toLocaleString("zh-CN")}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          task.status === "COMPLETED" 
                            ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50" 
                            : task.status === "FAILED" 
                            ? "bg-rose-950/40 text-rose-400 border border-rose-900/50" 
                            : task.status === "RUNNING"
                            ? "bg-amber-950/40 text-amber-400 border border-amber-900/50 animate-pulse"
                            : "bg-[#27272a] text-[#a1a1aa]"
                        }`}>
                          {task.status === "COMPLETED" ? "成功" : task.status === "FAILED" ? "失败" : task.status === "RUNNING" ? "运行中" : "排队中"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Recent System Errors */}
      <div className="p-6 bg-[#18181b]/30 border border-[#27272a]/60 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span>最近系统异常</span>
          </h3>
          <Link href="/admin" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition cursor-pointer">
            <span>日志中心</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentErrors.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-lg">
            系统运行平稳，最近无报错日志 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {recentErrors.map((log) => (
              <div 
                key={log.id} 
                className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-rose-900/50 transition-all duration-200"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-rose-900/40 text-rose-400 text-[9px] font-bold rounded uppercase">
                      {log.category}
                    </span>
                    <span className="text-xs font-medium text-white">{log.message}</span>
                  </div>
                </div>
                <div className="text-[10px] text-[#71717a] font-mono whitespace-nowrap">
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
