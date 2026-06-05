"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  ShieldCheck,
  Archive,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Loader2,
  Play,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Trash2,
} from "lucide-react";
import {
  PLATFORMS,
  CONTENT_TYPES,
  TRUST_LEVELS,
  VERIFICATION_STATUSES,
  PRIORITIES,
} from "@/types";
import { ChannelManager } from "@/components/ChannelManager";
import { WechatImportDialog } from "@/components/WechatImportDialog";
import {
  ArticlePreviewDialog,
  type PreviewArticle,
} from "@/components/ArticlePreviewDialog";
import { waitForAdminTask } from "@/lib/client-admin-task";

// 平台标签
const PLATFORM_LABELS: Record<string, string> = {
  website: "网站",
  wechat: "微信",
  bilibili: "B站",
  xiaohongshu: "小红书",
};

// 内容类型标签
const CONTENT_TYPE_LABELS: Record<string, string> = {
  policy_analysis: "政策解读",
  social_issue: "社会问题",
  economic_trend: "经济趋势",
  cultural_heritage: "文化传承",
  ecological_protection: "生态保护",
  legal_regulation: "法治法规",
  tech_innovation: "科技创新",
  education_reform: "教育改革",
  livelihood_welfare: "民生福祉",
  international_affairs: "国际事务",
};

// 信任等级标签
const TRUST_LEVEL_LABELS: Record<string, string> = {
  official_primary: "官方一手",
  official_repost: "官方转载",
  verified_media: "认证媒体",
  expert_opinion: "专家观点",
  unverified: "未验证",
};

// 验证状态标签
const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "未核验",
  verified: "已核验",
  disputed: "有争议",
  outdated: "已过时",
  retracted: "已撤回",
};

// 验证状态颜色
const VERIFICATION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  unverified: "secondary",
  verified: "default",
  disputed: "destructive",
  outdated: "outline",
  retracted: "destructive",
};

interface SourceItem {
  id: string;
  name: string;
  externalId: string | null;
  platform: string;
  contentType: string;
  trustLevel: string;
  regionScopes: string;
  baseUrl: string | null;
  profileUrl: string | null;
  priority: string;
  collectionMode: string | null;
  isEnabled: boolean;
  verificationStatus: string;
  keywords: string;
  collectionFrequency: string | null;
  lastCollectedAt: string | null;
  lastError: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  provider: string | null;
  feedId: string | null;
  lastSyncedAt: string | null;
  hitRate: number;
  filterRate: number;
  effectiveRate: number;
  avgAiScore: number | null;
  sourceGrade: string | null;
  metricsUpdatedAt: string | null;
  _count: { contentItems: number };
}

interface SourcesResponse {
  data: SourceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface SourceForm {
  name: string;
  externalId: string;
  platform: string;
  contentType: string;
  trustLevel: string;
  regionScopes: string;
  baseUrl: string;
  profileUrl: string;
  priority: string;
  collectionMode: string;
  isEnabled: boolean;
  keywords: string;
  collectionFrequency: string;
}

const emptyForm: SourceForm = {
  name: "",
  externalId: "",
  platform: "website",
  contentType: "policy_analysis",
  trustLevel: "unverified",
  regionScopes: "",
  baseUrl: "",
  profileUrl: "",
  priority: "P2",
  collectionMode: "",
  isEnabled: true,
  keywords: "",
  collectionFrequency: "",
};

function parseJsonArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function SubscriptionsPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [contentType, setContentType] = useState("all");
  const [trustLevel, setTrustLevel] = useState("all");
  const [isEnabled, setIsEnabled] = useState("all");
  const [verificationStatus, setVerificationStatus] = useState("all");

  // Dialog state
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [form, setForm] = useState<SourceForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Verify dialog
  const [verifySource, setVerifySource] = useState<SourceItem | null>(null);
  const [verifyStatus, setVerifyStatus] = useState("verified");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Collect state
  const [collectingSource, setCollectingSource] = useState<string | null>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewArticles, setPreviewArticles] = useState<PreviewArticle[]>([]);
  const [previewSource, setPreviewSource] = useState<SourceItem | null>(null);
  
  // WeChat Import Dialog state
  const [importWechatSource, setImportWechatSource] = useState<SourceItem | null>(null);

  // WeWe RSS delete confirmation dialog
  const [weweDeleteDialogOpen, setWeweDeleteDialogOpen] = useState(false);
  const [pendingDeleteSources, setPendingDeleteSources] = useState<Array<{ id: string; feedId: string; name: string }>>([]);
  const [deletingSources, setDeletingSources] = useState(false);

  // Channel expand state
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  // Frequency labels
  const FREQUENCY_LABELS: Record<string, string> = {
    daily: "每日",
    weekly: "每周",
    manual: "手动",
    hourly: "每小时",
  };

  const pageSize = 20;

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (platform !== "all") params.set("platform", platform);
      if (contentType !== "all") params.set("contentType", contentType);
      if (trustLevel !== "all") params.set("trustLevel", trustLevel);
      if (isEnabled !== "all") params.set("isEnabled", isEnabled);
      if (verificationStatus !== "all")
        params.set("verificationStatus", verificationStatus);

      const res = await fetch(`/api/sources?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: SourcesResponse = await res.json();
      setSources(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, search, platform, contentType, trustLevel, isEnabled, verificationStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSources();
  }, [fetchSources]);

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, platform, contentType, trustLevel, isEnabled, verificationStatus]);

  function openCreate() {
    setEditingSource(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(source: SourceItem) {
    setEditingSource(source);
    setForm({
      name: source.name,
      externalId: source.externalId ?? "",
      platform: source.platform,
      contentType: source.contentType,
      trustLevel: source.trustLevel,
      regionScopes: parseJsonArray(source.regionScopes).join(", "),
      baseUrl: source.baseUrl ?? "",
      profileUrl: source.profileUrl ?? "",
      priority: source.priority,
      collectionMode: source.collectionMode ?? "",
      isEnabled: source.isEnabled,
      keywords: parseJsonArray(source.keywords).join(", "),
      collectionFrequency: source.collectionFrequency ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("请输入来源名称");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        externalId: form.externalId || null,
        baseUrl: form.baseUrl || null,
        profileUrl: form.profileUrl || null,
        collectionMode: form.collectionMode || null,
        collectionFrequency: form.collectionFrequency || null,
        regionScopes: form.regionScopes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        keywords: form.keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const url = editingSource
        ? `/api/sources/${editingSource.id}`
        : "/api/sources";
      const method = editingSource ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }

      setShowForm(false);
      fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(source: SourceItem) {
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !source.isEnabled }),
      });
      if (!res.ok) throw new Error("操作失败");
      fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    }
  }

  function openVerify(source: SourceItem) {
    setVerifySource(source);
    setVerifyStatus(source.verificationStatus === "verified" ? "unverified" : "verified");
    setVerifyNotes("");
  }

  async function handleVerify() {
    if (!verifySource) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/sources/${verifySource.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationStatus: verifyStatus,
          notes: verifyNotes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "核验失败");
      }
      setVerifySource(null);
      fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "核验失败");
    } finally {
      setVerifying(false);
    }
  }

  async function handleArchive(source: SourceItem) {
    if (!confirm(`确定要归档来源「${source.name}」吗？`)) return;
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("归档失败");
      fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "归档失败");
    }
  }

  async function handleCollectNow(source: SourceItem) {
    if (collectingSource) return;

    // 微信来源走预览流程
    if (source.platform === "wechat") {
      setPreviewSource(source);
      setPreviewOpen(true);
      setPreviewLoading(true);
      setPreviewArticles([]);

      try {
        const res = await fetch("/api/collectors/wechat/sync/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: source.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "预览失败");
        setPreviewArticles(data.articles ?? []);
      } catch (err) {
        alert(err instanceof Error ? err.message : "预览失败");
        setPreviewOpen(false);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    // 其他平台走原有流程
    setCollectingSource(source.id);

    try {
      let apiEndpoint: string;
      let body: Record<string, string>;

      if (
        source.platform === "bilibili" ||
        source.platform === "xiaohongshu"
      ) {
        apiEndpoint = "/api/collectors/mediacrawler/crawl";
        body = { platform: source.platform, userId: source.id };
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

      if (!res.ok) {
        throw new Error(data.error ?? "采集失败");
      }
      if (data.taskId) {
        alert(data.message ?? "已加入后台任务队列");
        const task = await waitForAdminTask(data.taskId);
        const result = task.result ? JSON.parse(task.result) : null;
        if (task.status === "FAILED") {
          throw new Error(result?.message ?? "后台采集任务失败");
        }
        const skipped = result?.skippedCount ?? 0;
        alert(
          `采集完成：发现 ${result?.discoveredCount ?? 0} 条，导入 ${result?.importedCount ?? 0} 条` +
            (skipped > 0 ? `，跳过 ${skipped} 条` : "")
        );
        fetchSources();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "采集失败");
    } finally {
      setCollectingSource(null);
    }
  }

  async function handlePreviewConfirm(selectedUrls: string[]) {
    if (!previewSource) return;
    setPreviewOpen(false);
    setCollectingSource(previewSource.id);

    try {
      const res = await fetch("/api/collectors/wechat/sync/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: previewSource.id,
          selectedUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");

      const skipped = data.skippedCount ?? 0;
      alert(
        `导入完成：发现 ${data.discoveredCount ?? 0} 条，导入 ${data.importedCount ?? 0} 条` +
          (skipped > 0 ? `，跳过 ${skipped} 条` : "")
      );
      fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "导入失败");
    } finally {
      setCollectingSource(null);
      setPreviewSource(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">来源管理</h1>
            <p className="text-sm text-muted-foreground">
              管理内容采集来源，配置平台、信任等级与核验状态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchSources}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/sources/quality", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                  fetchSources();
                  alert(`已刷新 ${data.refreshed} 个来源的质量指标`);
                }
              }}
            >
              刷新质量
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/integrations/wewe-rss/sync-sources", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                const data = await res.json();
                if (data.success) {
                  fetchSources();
                  if (data.toDelete && data.toDelete.length > 0) {
                    setPendingDeleteSources(data.toDelete);
                    setWeweDeleteDialogOpen(true);
                  } else {
                    alert(data.message);
                  }
                } else {
                  alert(data.error ?? "同步失败");
                }
              }}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              同步 WeWe
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              新建来源
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索来源名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>

          <Select value={platform} onValueChange={(v) => { if (v) setPlatform(v); }}>
            <SelectTrigger className="w-28">
              <SelectValue>
                {platform === "all" ? "全部平台" : (PLATFORM_LABELS[platform] ?? platform)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLATFORM_LABELS[p] ?? p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={contentType} onValueChange={(v) => { if (v) setContentType(v); }}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {contentType === "all" ? "全部类型" : (CONTENT_TYPE_LABELS[contentType] ?? contentType)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={trustLevel} onValueChange={(v) => { if (v) setTrustLevel(v); }}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {trustLevel === "all" ? "全部等级" : (TRUST_LEVEL_LABELS[trustLevel] ?? trustLevel)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部等级</SelectItem>
              {TRUST_LEVELS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRUST_LEVEL_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={isEnabled} onValueChange={(v) => { if (v) setIsEnabled(v); }}>
            <SelectTrigger className="w-28">
              <SelectValue>
                {isEnabled === "all" ? "全部状态" : isEnabled === "true" ? "已启用" : "已停用"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="true">已启用</SelectItem>
              <SelectItem value="false">已停用</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={verificationStatus}
            onValueChange={(v) => { if (v) setVerificationStatus(v); }}
          >
            <SelectTrigger className="w-28">
              <SelectValue>
                {verificationStatus === "all" ? "全部" : (VERIFICATION_LABELS[verificationStatus] ?? verificationStatus)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {VERIFICATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {VERIFICATION_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error ? (
          <div className="flex items-center justify-center h-48 text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <p>暂无来源</p>
            <p className="text-sm">点击「新建来源」添加第一个采集来源</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="w-20">平台</TableHead>
                <TableHead className="w-24">来源</TableHead>
                <TableHead className="w-24">内容类型</TableHead>
                <TableHead className="w-24">信任等级</TableHead>
                <TableHead className="w-16">质量</TableHead>
                <TableHead className="w-16">优先级</TableHead>
                <TableHead className="w-16">频率</TableHead>
                <TableHead className="w-24">最近采集</TableHead>
                <TableHead className="w-16">启用</TableHead>
                <TableHead className="w-20">核验</TableHead>
                <TableHead className="w-16 text-right">条目</TableHead>
                <TableHead className="w-40 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <Fragment key={source.id}>
                <TableRow>
                  <TableCell>
                    {source.platform === "website" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6"
                        onClick={() => setExpandedSource(expandedSource === source.id ? null : source.id)}
                        title="展开栏目配置"
                      >
                        {expandedSource === source.id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    <div>
                      <span>{source.name}</span>
                      {source.baseUrl && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {source.baseUrl}
                        </span>
                      )}
                      {source.lastError && (
                        <span className="flex items-center gap-1 text-[10px] text-destructive mt-0.5">
                          <AlertCircle className="h-3 w-3" />
                          {source.lastError.slice(0, 50)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {PLATFORM_LABELS[source.platform] ?? source.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {source.provider === "wewe-rss" ? (
                      <Badge variant="default" className="text-xs bg-blue-600">
                        WeWe RSS
                      </Badge>
                    ) : source.provider === "werss-external" ? (
                      <Badge variant="secondary" className="text-xs">
                        WeRSS
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">手动</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {CONTENT_TYPE_LABELS[source.contentType] ??
                        source.contentType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {TRUST_LEVEL_LABELS[source.trustLevel] ?? source.trustLevel}
                  </TableCell>
                  <TableCell>
                    {source.sourceGrade ? (
                      <Badge
                        variant={
                          source.sourceGrade === "A"
                            ? "default"
                            : source.sourceGrade === "B"
                              ? "secondary"
                              : source.sourceGrade === "C"
                                ? "outline"
                                : "destructive"
                        }
                        className="text-xs"
                        title={`命中率 ${Math.round(source.hitRate * 100)}%，过滤率 ${Math.round(source.filterRate * 100)}%`}
                      >
                        {source.sourceGrade}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        source.priority === "P0"
                          ? "destructive"
                          : source.priority === "P1"
                            ? "default"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {source.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {source.collectionFrequency
                      ? FREQUENCY_LABELS[source.collectionFrequency] ?? source.collectionFrequency
                      : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {source.lastCollectedAt
                      ? new Date(source.lastCollectedAt).toLocaleDateString("zh-CN")
                      : "未采集"}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={source.isEnabled}
                      onCheckedChange={() => handleToggleEnabled(source)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        VERIFICATION_VARIANT[source.verificationStatus] ??
                        "secondary"
                      }
                      className="text-xs"
                    >
                      {VERIFICATION_LABELS[source.verificationStatus] ??
                        source.verificationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {source._count.contentItems}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {source.platform === "wechat" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setImportWechatSource(source)}
                          title="导入文章"
                        >
                          <Layers />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCollectNow(source)}
                        disabled={collectingSource === source.id || !source.isEnabled}
                        title={source.provider === "wewe-rss" ? "刷新并采集" : "立即采集"}
                      >
                        {collectingSource === source.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEdit(source)}
                        title="编辑"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openVerify(source)}
                        title="核验"
                      >
                        <ShieldCheck />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleArchive(source)}
                        title="归档"
                      >
                        <Archive />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedSource === source.id && source.platform === "website" && (
                  <TableRow key={`${source.id}-channels`}>
                    <TableCell colSpan={12} className="bg-muted/30 px-6 py-3">
                      <ChannelManager sourceId={source.id} sourceName={source.name} />
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-3">
          <span className="text-sm text-muted-foreground">
            共 {total} 个来源，第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) setShowForm(false);
        }}
      >
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSource ? "编辑来源" : "新建来源"}
              </DialogTitle>
              <DialogDescription>
                {editingSource
                  ? "修改来源的基本信息和配置"
                  : "添加一个新的内容采集来源"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  名称 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="来源名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">平台</label>
                  <Select
                    value={form.platform}
                    onValueChange={(v) => {
                      if (v) setForm((f) => ({ ...f, platform: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {PLATFORM_LABELS[form.platform] ?? form.platform}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.filter(
                        (p) => p !== "bilibili" && p !== "xiaohongshu"
                      ).map((p) => (
                        <SelectItem key={p} value={p}>
                          {PLATFORM_LABELS[p] ?? p}
                        </SelectItem>
                      ))}
                      <SelectItem value="bilibili" disabled>
                        B站（需要 MediaCrawler 服务）
                      </SelectItem>
                      <SelectItem value="xiaohongshu" disabled>
                        小红书（需要 MediaCrawler 服务）
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">优先级</label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => {
                      if (v) setForm((f) => ({ ...f, priority: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {form.priority}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">内容类型</label>
                  <Select
                    value={form.contentType}
                    onValueChange={(v) => {
                      if (v) setForm((f) => ({ ...f, contentType: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {CONTENT_TYPE_LABELS[form.contentType] ?? form.contentType}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONTENT_TYPE_LABELS[t] ?? t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">信任等级</label>
                  <Select
                    value={form.trustLevel}
                    onValueChange={(v) => {
                      if (v) setForm((f) => ({ ...f, trustLevel: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {TRUST_LEVEL_LABELS[form.trustLevel] ?? form.trustLevel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TRUST_LEVELS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TRUST_LEVEL_LABELS[t] ?? t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">外部 ID</label>
                <Input
                  value={form.externalId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, externalId: e.target.value }))
                  }
                  placeholder="平台账号/ID（可选）"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">基础 URL</label>
                <Input
                  value={form.baseUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, baseUrl: e.target.value }))
                  }
                  placeholder="https://..."
                />
                {form.platform === "wechat" && (
                  <p className="text-xs text-muted-foreground">
                    本地 WeWe RSS / we-mp-rss 用户：填写 RSS 地址（如 http://localhost:4000/feeds/xxx.rss）。
                    以 http(s):// 开头的地址走标准 RSS 解析，不需要 WERSS_ACCESS_KEY。
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">主页 URL</label>
                <Input
                  value={form.profileUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, profileUrl: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">采集模式</label>
                  <Input
                    value={form.collectionMode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        collectionMode: e.target.value,
                      }))
                    }
                    placeholder="rss / crawl / api"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">采集频率</label>
                  <Input
                    value={form.collectionFrequency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        collectionFrequency: e.target.value,
                      }))
                    }
                    placeholder="daily / hourly"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  关键词（逗号分隔）
                </label>
                <Input
                  value={form.keywords}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, keywords: e.target.value }))
                  }
                  placeholder="关键词1, 关键词2, ..."
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  适用地区（逗号分隔）
                </label>
                <Input
                  value={form.regionScopes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, regionScopes: e.target.value }))
                  }
                  placeholder="全国, 广东, 湖南, ..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.isEnabled}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isEnabled: !!checked }))
                  }
                />
                <label className="text-sm font-medium">启用此来源</label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editingSource ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Verify Dialog */}
      <Dialog
        open={!!verifySource}
        onOpenChange={(open) => {
          if (!open) setVerifySource(null);
        }}
      >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>核验来源</DialogTitle>
              <DialogDescription>
                对「{verifySource?.name}」进行核验状态变更
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">核验状态</label>
                <Select value={verifyStatus} onValueChange={(v) => { if (v) setVerifyStatus(v); }}>
                  <SelectTrigger>
                    <SelectValue>
                      {VERIFICATION_LABELS[verifyStatus] ?? verifyStatus}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {VERIFICATION_LABELS[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">备注</label>
                <Input
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="核验备注（可选）"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setVerifySource(null)}
              >
                取消
              </Button>
              <Button onClick={handleVerify} disabled={verifying}>
                {verifying && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                确认核验
              </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {importWechatSource && (
        <WechatImportDialog
          sourceId={importWechatSource.id}
          sourceName={importWechatSource.name}
          open={!!importWechatSource}
          onOpenChange={(open) => {
            if (!open) setImportWechatSource(null);
          }}
          onSuccess={() => fetchSources()}
        />
      )}

      <ArticlePreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewOpen(false);
            setPreviewSource(null);
          }
        }}
        articles={previewArticles}
        loading={previewLoading}
        sourceName={previewSource?.name}
        onConfirm={handlePreviewConfirm}
      />

      {/* WeWe RSS 删除确认弹窗 */}
      <Dialog open={weweDeleteDialogOpen} onOpenChange={setWeweDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>同步删除来源确认</DialogTitle>
            <DialogDescription>
              检测到 WeWe RSS 中已删除以下公众号。是否同步删除申论项目中的对应来源？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pendingDeleteSources.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded border">
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="text-sm">{d.name}</span>
                <Badge variant="outline" className="text-xs">{d.feedId}</Badge>
              </div>
            ))}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>注意：</p>
            <p>1. 只会删除 WeWe RSS 同步来的来源</p>
            <p>2. 不会删除你手动添加的来源</p>
            <p>3. 默认不会删除已入库文章</p>
            <p>4. 删除后可通过重新同步恢复</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeweDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setDeletingSources(true);
                try {
                  const res = await fetch("/api/integrations/wewe-rss/delete-missing-sources", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sourceIds: pendingDeleteSources.map((d) => d.id),
                      deleteContentItems: false,
                    }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert(`已删除 ${data.deleted} 个来源（已入库文章未删除）`);
                    setPendingDeleteSources([]);
                    fetchSources();
                  } else {
                    alert(data.error ?? "删除失败");
                  }
                } catch {
                  alert("删除失败");
                } finally {
                  setDeletingSources(false);
                  setWeweDeleteDialogOpen(false);
                }
              }}
              disabled={deletingSources}
            >
              {deletingSources ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确认删除（不删文章）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
