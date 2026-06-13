"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BatchActions } from "@/components/BatchActions";
import { ArticleDetail } from "@/components/ArticleDetail";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshCw, Search, Play, Brain, Loader2, RotateCcw, Calendar, ChevronDown, Star, CheckCircle, BookmarkCheck, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { waitForAdminTask } from "@/lib/client-admin-task";
import { CONTENT_GENRE_LABELS } from "@/lib/display-labels";
import { EmptyState } from "@/components/ui/empty-state";

interface ContentItemData {
  id: string;
  title: string;
  originalUrl: string;
  platform: string;
  fullText: string | null;
  excerpt: string | null;
  contentType: string;
  topicTags: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  processingStatus: string;
  qualityStatus: string;
  filterReason: string | null;
  aiScore: number | null;
  aiDecision: string | null;
  adminReviewStatus: string | null;
  aiReason: string | null;
  contentGenre: string | null;
  aiAssessedAt: string | null;
  aiScoreDetail: string | null;
  aiScoredAt: string | null;
  effectiveTextLength: number;
  section: string | null;
  ownerUserId: string | null;
  visibility: string | null;
  source?: { name: string } | null;
  _count: { materialCards: number };
  userRead?: boolean;
  userIgnored?: boolean;
  userBookmarked?: boolean;
}

interface ContentItemsResponse {
  data: ContentItemData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface SourceOption {
  id: string;
  name: string;
  platform?: string;
}

const QUALITY_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待检测" },
  { value: "candidate", label: "候选" },
  { value: "filtered", label: "已过滤" },
  { value: "accepted", label: "已接受" },
];

const AI_DECISION_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "未评估" },
  { value: "accept", label: "已通过" },
  { value: "reject", label: "已拒绝" },
];

const ADMIN_REVIEW_STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "pending_ai", label: "待AI" },
  { value: "pending_admin", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
];

const GENRE_BADGE_COLORS: Record<string, string> = {
  commentary: "bg-blue-100 text-blue-700",
  policy_interpretation: "bg-purple-100 text-purple-700",
  case_practice: "bg-green-100 text-green-700",
  ordinary_news: "bg-gray-100 text-gray-500",
  meeting_news: "bg-gray-100 text-gray-500",
  notice: "bg-gray-100 text-gray-500",
  other: "bg-gray-100 text-gray-500",
};

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "未获取";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "未获取";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return "未获取";
  }
}

export function ArticlesPage({ managementMode = false }: { managementMode?: boolean }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96 text-muted-foreground">加载中...</div>}>
      <ArticlesPageInner managementMode={managementMode} />
    </Suspense>
  );
}

function ArticlesPageInner({ managementMode }: { managementMode: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ContentItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);

  // 筛选条件（表单状态，点击搜索后生效）
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [sourceType, setSourceType] = useState(searchParams.get("sourceType") ?? "all");
  const [sourceName, setSourceName] = useState(searchParams.get("sourceName") ?? "all");
  const [section, setSection] = useState(searchParams.get("section") ?? "all");
  const [qualityStatus, setQualityStatus] = useState(searchParams.get("qualityStatus") ?? "all");
  const [aiDecision, setAiDecision] = useState(searchParams.get("aiDecision") ?? "all");
  const [adminReviewStatus, setAdminReviewStatus] = useState(searchParams.get("adminReviewStatus") ?? "all");
  const [publishedStart, setPublishedStart] = useState(searchParams.get("publishedStart") ?? "");
  const [publishedEnd, setPublishedEnd] = useState(searchParams.get("publishedEnd") ?? "");
  const [collectedStart, setCollectedStart] = useState(searchParams.get("collectedStart") ?? "");
  const [collectedEnd, setCollectedEnd] = useState(searchParams.get("collectedEnd") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "createdAt");
  const [pageSize, setPageSize] = useState(20);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 来源选项
  const [allSources, setAllSources] = useState<SourceOption[]>([]);

  // Collection state
  const [collecting, setCollecting] = useState(false);
  const [collectProgress, setCollectProgress] = useState<string | null>(null);

  // AI assessment state
  const [assessing, setAssessing] = useState(false);
  const [assessProgress, setAssessProgress] = useState<string | null>(null);

  // Batch review state
  const [reviewing, setReviewing] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail view
  const [detailItem, setDetailItem] = useState<ContentItemData | null>(null);

  // Dev debug mode: show owner/visibility columns
  const [showDebugCols, setShowDebugCols] = useState(false);

  // Tab filter (all / recommended / favorites)
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "all");

  // 加载来源列表
  useEffect(() => {
    fetch("/api/sources?pageSize=500")
      .then((r) => {
        if (!r.ok) return []; // 401/403 for anonymous users — return empty
        return r.json();
      })
      .then((data) => {
        const items = data?.data ?? data;
        setAllSources(Array.isArray(items) ? items : []);
      })
      .catch(() => {});
  }, []);

  const filteredSourceOptions = allSources.filter((s) => {
    if (sourceType === "all") return true;
    return s.platform === sourceType;
  });

  const handleSourceTypeChange = (val: string | null) => {
    if (!val) return;
    setSourceType(val);
    if (sourceName !== "all") {
      const selectedSource = allSources.find((s) => s.name === sourceName);
      if (selectedSource && val !== "all" && selectedSource.platform !== val) {
        setSourceName("all");
      }
    }
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (keyword) params.set("keyword", keyword);
      if (sourceType && sourceType !== "all") params.set("sourceType", sourceType);
      if (sourceName && sourceName !== "all") params.set("sourceName", sourceName);
      if (section && section !== "all") params.set("section", section);
      if (qualityStatus !== "all") params.set("qualityStatus", qualityStatus);
      if (aiDecision !== "all") params.set("aiDecision", aiDecision);
      if (adminReviewStatus !== "all") params.set("adminReviewStatus", adminReviewStatus);
      if (publishedStart) params.set("publishedStart", publishedStart);
      if (publishedEnd) params.set("publishedEnd", publishedEnd);
      if (collectedStart) params.set("collectedStart", collectedStart);
      if (collectedEnd) params.set("collectedEnd", collectedEnd);
      if (sortBy !== "createdAt") params.set("sortBy", sortBy);
      if (activeTab === "recommended") params.set("filter", "approved");
      if (activeTab === "favorites") params.set("filter", "favorites");

      const res = await fetch(`/api/articles?${params.toString()}`);
      if (!res.ok) throw new Error("请求失败");
      const json: ContentItemsResponse = await res.json();
      setItems(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, sourceType, sourceName, section, qualityStatus, aiDecision, adminReviewStatus, publishedStart, publishedEnd, collectedStart, collectedEnd, sortBy, activeTab]);

  // 同步筛选条件到 URL
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (sourceType && sourceType !== "all") params.set("sourceType", sourceType);
    if (sourceName && sourceName !== "all") params.set("sourceName", sourceName);
    if (section && section !== "all") params.set("section", section);
    if (qualityStatus !== "all") params.set("qualityStatus", qualityStatus);
    if (aiDecision !== "all") params.set("aiDecision", aiDecision);
    if (adminReviewStatus !== "all") params.set("adminReviewStatus", adminReviewStatus);
    if (publishedStart) params.set("publishedStart", publishedStart);
    if (publishedEnd) params.set("publishedEnd", publishedEnd);
    if (collectedStart) params.set("collectedStart", collectedStart);
    if (collectedEnd) params.set("collectedEnd", collectedEnd);
    if (sortBy !== "createdAt") params.set("sortBy", sortBy);
    if (activeTab && activeTab !== "all") params.set("tab", activeTab);
    const qs = params.toString();
    router.replace(`/articles${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [keyword, sourceType, sourceName, section, qualityStatus, aiDecision, adminReviewStatus, publishedStart, publishedEnd, collectedStart, collectedEnd, sortBy, activeTab, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  // 点击搜索按钮
  function handleSearch() {
    setPage(1);
    syncUrl();
    fetchItems();
  }

  // 重置筛选
  function handleReset() {
    setKeyword("");
    setSourceType("all");
    setSourceName("all");
    setSection("all");
    setQualityStatus("all");
    setAiDecision("all");
    setAdminReviewStatus("all");
    setPublishedStart("");
    setPublishedEnd("");
    setCollectedStart("");
    setCollectedEnd("");
    setSortBy("createdAt");
    setActiveTab("all");
    setPage(1);
    router.replace("/articles", { scroll: false });
  }

  // Enter 键触发搜索
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((a) => a.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  // 开始采集
  async function handleCollect() {
    setCollecting(true);
    setCollectProgress("正在采集...");
    try {
      const res = await fetch("/api/collectors/web/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setCollectProgress(data.message ?? "已加入后台采集队列");
        if (data.taskId) {
          const task = await waitForAdminTask(data.taskId);
          const result = task.result ? JSON.parse(task.result) : null;
          if (task.status === "FAILED") {
            setCollectProgress(`采集失败: ${result?.message ?? "后台任务失败"}`);
          } else {
            setCollectProgress(`采集完成：发现 ${result?.discoveredCount ?? 0} 篇，导入 ${result?.importedCount ?? 0} 篇`);
            fetchItems();
          }
        }
      } else {
        setCollectProgress(`采集失败: ${data.error}`);
      }
    } catch {
      setCollectProgress("采集请求失败");
    } finally {
      setCollecting(false);
      setTimeout(() => setCollectProgress(null), 5000);
    }
  }

  // AI 批量评估
  async function handleAssess() {
    const idsToAssess = selected.size > 0
      ? Array.from(selected)
      : items.filter((i) => i.qualityStatus === "candidate" && !i.aiDecision).map((i) => i.id);

    if (idsToAssess.length === 0) {
      toast.warning("没有可评估的条目", { description: "请先选择或确保有候选条目" });
      return;
    }

    setAssessing(true);
    setAssessProgress(`正在评估 ${idsToAssess.length} 个条目...`);
    try {
      const res = await fetch("/api/content-items/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToAssess }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssessProgress(data.message ?? `已加入后台评估队列，共 ${data.queuedCount ?? idsToAssess.length} 条`);
        if (data.taskId) {
          const task = await waitForAdminTask(data.taskId);
          const result = task.result ? JSON.parse(task.result) : null;
          if (task.status === "FAILED") {
            setAssessProgress(`评估失败: ${result?.message ?? "后台任务失败"}`);
          } else {
            setAssessProgress(`评估完成：接受 ${result?.accepted ?? 0} 篇，拒绝 ${result?.rejected ?? 0} 篇`);
            setSelected(new Set());
            fetchItems();
          }
        }
      } else {
        setAssessProgress(`评估失败: ${data.error}`);
      }
    } catch {
      setAssessProgress("评估请求失败");
    } finally {
      setAssessing(false);
      setTimeout(() => setAssessProgress(null), 5000);
    }
  }

  async function handleGenerate() {
    if (generating) return;
    if (selected.size === 0) return;

    setGenerating(true);
    const selectedItems = items.filter((item) => selected.has(item.id));
    const acceptedItems = selectedItems.filter((item) => item.adminReviewStatus === "approved");
    const skippedCount = selectedItems.length - acceptedItems.length;
    let queuedCount = 0;
    let existedCount = 0;
    let failedCount = 0;

    setGenerateProgress(`正在为 ${acceptedItems.length} 篇已审核通过的文章生成素材卡...`);

    try {
      if (acceptedItems.length === 0) {
        setGenerateProgress(`已跳过 ${skippedCount} 篇：需先审核通过`);
        toast.warning("没有可生成的文章", { description: "请先选择已审核通过的文章" });
        return;
      }

      for (const [index, item] of acceptedItems.entries()) {
        setGenerateProgress(`正在生成 ${index + 1} / ${acceptedItems.length}：${item.title}`);
        const res = await fetch(`/api/content-items/${item.id}/generate-card`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardType: "golden_sentence" }),
        });

        if (res.status === 409) {
          existedCount += 1;
          continue;
        }

        if (!res.ok) {
          failedCount += 1;
          continue;
        }

        queuedCount += 1;
      }

      setGenerateProgress(
        `已提交后台生成：排队 ${queuedCount} 张，已存在 ${existedCount} 张，跳过 ${skippedCount} 篇，失败 ${failedCount} 篇`
      );

      setSelected(new Set());
      if (queuedCount > 0) {
        fetchItems();
      }

      if (queuedCount > 0) {
        toast.success("批量生成任务已提交", {
          description: `排队 ${queuedCount} 张，已存在 ${existedCount} 张，跳过 ${skippedCount} 篇，失败 ${failedCount} 篇`,
        });
      }

      setTimeout(() => {
        setGenerateProgress(null);
        if (queuedCount > 0) router.push("/admin/tasks");
      }, 2000);
    } catch (err) {
      setGenerateProgress(null);
      toast.error("素材卡生成失败", { description: err instanceof Error ? err.message : "请稍后重试" });
    } finally {
      setGenerating(false);
    }
  }

  // 批量审核（通过/拒绝/强制通过）
  async function handleBatchReview(action: "approve" | "reject", opts?: { force?: boolean }) {
    if (reviewing) return;
    if (selected.size === 0) {
      toast.warning("请先选择文章");
      return;
    }
    const selectedItems = Array.from(selected);
    const note =
      action === "approve" && opts?.force
        ? prompt("强制通过理由（必填）") ?? ""
        : prompt(action === "approve" ? "审核备注（可选）" : "拒绝原因（可选）") ?? "";
    if (opts?.force && !note.trim()) {
      toast.error("强制通过必须填写理由");
      return;
    }

    setReviewing(true);
    try {
      const res = await fetch("/api/admin/content-items/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedItems,
          action,
          note: note || undefined,
          force: opts?.force,
        }),
      });
      if (res.ok) {
        toast.success(`已${action === "approve" ? "通过" : "拒绝"} ${selectedItems.length} 篇`);
        setSelected(new Set());
        fetchItems();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "操作失败");
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setReviewing(false);
    }
  }

  // 推送单篇至今日推荐（仅审核通过）
  async function pushFeature(id: string, title?: string) {
    const res = await fetch("/api/admin/content-items/feature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast.success("已推送至今日推荐", { description: title });
      fetchItems();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "推送失败");
    }
  }

  const allSelected = items.length > 0 && items.every((a) => selected.has(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-3.5 bg-card">
        <PageHeader
          title="文章列表"
          description={managementMode ? "管理采集的内容条目，AI 评估后生成素材卡" : "浏览已采集的内容条目，按来源、主题和时间筛选阅读"}
          actions={
            <div className="flex items-center gap-2">
              {managementMode && (
                <>
                  <Button variant="default" size="sm" onClick={handleCollect} disabled={collecting}>
                    {collecting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                    {collecting ? "采集中..." : "开始采集"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAssess} disabled={assessing}>
                    {assessing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Brain className="mr-1.5 h-4 w-4" />}
                    {assessing ? "评估中..." : "AI 评估"}
                  </Button>
                  <Button
                    variant={showDebugCols ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowDebugCols(!showDebugCols)}
                    title="切换 owner/visibility 调试列"
                  >
                    🐛 调试
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={fetchItems}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                刷新
              </Button>
            </div>
          }
        />
        {managementMode && (collectProgress || assessProgress) && (
          <div className="mt-2 text-sm text-muted-foreground">
            {collectProgress && <p>{collectProgress}</p>}
            {assessProgress && <p>{assessProgress}</p>}
          </div>
        )}
      </div>

      {/* Tab filter: all / recommended / favorites */}
      <div className="px-6 pt-3">
        <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="recommended">推荐</TabsTrigger>
            <TabsTrigger value="favorites">收藏</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="border-b px-6 py-3 bg-muted/20">
        <div className="flex flex-wrap items-end gap-3">
          {/* 关键词 */}
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">关键词</label>
            <Input
              placeholder="搜索标题、正文、来源"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
          </div>

          {/* 来源类型 */}
          <div className="w-32">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">来源类型</label>
            <Select value={sourceType} onValueChange={handleSourceTypeChange}>
              <SelectTrigger className="h-8" data-testid="source-type-select" aria-label="来源类型">
                <SelectValue>
                  {sourceType === "all" ? "全部" : sourceType === "website" ? "网站" : "公众号"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="website">网站</SelectItem>
                <SelectItem value="wechat">公众号</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 来源 */}
          <div className="w-48">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">文章来源</label>
            <Select value={sourceName} onValueChange={(v) => { if (v) setSourceName(v); }}>
              <SelectTrigger className="h-8" data-testid="source-name-select" aria-label="文章来源">
                <SelectValue>
                  {sourceName === "all" ? "全部来源" : sourceName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                {filteredSourceOptions.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI 评估状态 */}
          <div className="w-40">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">AI 评估状态</label>
            <Select value={aiDecision} onValueChange={(v) => { if (v) setAiDecision(v); }}>
              <SelectTrigger className="h-8" aria-label="AI评估状态">
                <SelectValue>
                  {AI_DECISION_OPTIONS.find(o => o.value === aiDecision)?.label ?? "全部"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AI_DECISION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 审核状态 */}
          {managementMode && (
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">审核状态</label>
              <Select value={adminReviewStatus} onValueChange={(v) => { if (v) setAdminReviewStatus(v); }}>
                <SelectTrigger className="h-8" aria-label="审核状态">
                  <SelectValue>
                    {ADMIN_REVIEW_STATUS_OPTIONS.find(o => o.value === adminReviewStatus)?.label ?? "全部"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_REVIEW_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 h-8">
            <Button size="sm" onClick={handleSearch} className="h-8 px-4">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              搜索
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="h-8 px-3" title="重置筛选">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              重置
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground flex items-center gap-1 select-none font-medium"
            >
              {showAdvancedFilters ? "收起筛选" : "高级筛选"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showAdvancedFilters && "rotate-180")} />
            </Button>
          </div>
        </div>

        {/* 高级筛选展开项 */}
        {showAdvancedFilters && (
          <div className="mt-3 pt-3 border-t border-dashed border-border/60 grid grid-cols-2 md:grid-cols-4 gap-3 tw-animate-css fade-in">
            {/* 栏目 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">栏目</label>
              <Input
                placeholder="全部栏目"
                value={section === "all" ? "" : section}
                onChange={(e) => setSection(e.target.value || "all")}
                onKeyDown={handleKeyDown}
                className="h-8"
              />
            </div>

            {/* 素材价值 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">素材价值</label>
              <Select value={qualityStatus} onValueChange={(v) => { if (v) setQualityStatus(v); }}>
                <SelectTrigger className="h-8" aria-label="素材价值">
                  <SelectValue>
                    {QUALITY_STATUS_OPTIONS.find(o => o.value === qualityStatus)?.label ?? "全部"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 排序方式 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">排序方式</label>
              <Select value={sortBy} onValueChange={(v) => { if (v) setSortBy(v); }}>
                <SelectTrigger className="h-8" aria-label="排序方式">
                  <SelectValue>
                    {sortBy === "createdAt" ? "按采集时间" : sortBy === "publishedAt" ? "按发布时间" : sortBy === "aiScore" ? "按评分" : "按字数"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">按采集时间</SelectItem>
                  <SelectItem value="publishedAt">按发布时间</SelectItem>
                  <SelectItem value="aiScore">按评分</SelectItem>
                  <SelectItem value="effectiveTextLength">按字数</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
              {/* 文章发布时间 */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">文章发布时间（起）</label>
                <div className="relative w-full h-8 group">
                  <input
                    type="date"
                    value={publishedStart}
                    onChange={(e) => setPublishedStart(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-input bg-transparent text-sm pointer-events-none group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50 transition-colors">
                    <span className={publishedStart ? "text-foreground" : "text-muted-foreground"}>
                      {publishedStart || "年/月/日"}
                    </span>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">文章发布时间（止）</label>
                <div className="relative w-full h-8 group">
                  <input
                    type="date"
                    value={publishedEnd}
                    onChange={(e) => setPublishedEnd(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-input bg-transparent text-sm pointer-events-none group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50 transition-colors">
                    <span className={publishedEnd ? "text-foreground" : "text-muted-foreground"}>
                      {publishedEnd || "年/月/日"}
                    </span>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* 采集时间 */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">采集时间（起）</label>
                <div className="relative w-full h-8 group">
                  <input
                    type="date"
                    value={collectedStart}
                    onChange={(e) => setCollectedStart(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-input bg-transparent text-sm pointer-events-none group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50 transition-colors">
                    <span className={collectedStart ? "text-foreground" : "text-muted-foreground"}>
                      {collectedStart || "年/月/日"}
                    </span>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">采集时间（止）</label>
                <div className="relative w-full h-8 group">
                  <input
                    type="date"
                    value={collectedEnd}
                    onChange={(e) => setCollectedEnd(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-input bg-transparent text-sm pointer-events-none group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50 transition-colors">
                    <span className={collectedEnd ? "text-foreground" : "text-muted-foreground"}>
                      {collectedEnd || "年/月/日"}
                    </span>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col overflow-hidden ${detailItem ? "w-1/2" : "w-full"}`}>
          {/* Batch actions (only show when items are selected) */}
          {managementMode && selected.size > 0 && (
            <div className="px-6 py-2.5 border-b bg-muted/10 tw-animate-css slide-in-down">
              <BatchActions
                selectedCount={selected.size}
                totalCount={total}
                allSelected={allSelected}
                generating={generating}
                reviewing={reviewing}
                progress={generateProgress}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onGenerate={handleGenerate}
                onReview={handleBatchReview}
              />
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto px-6">
            {error ? (
              <div className="flex items-center justify-center h-48 text-destructive">{error}</div>
            ) : loading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">加载中...</div>
            ) : items.length === 0 ? (
              <EmptyState
                title="暂无符合条件的文章"
                description={managementMode ? "尝试调整筛选条件或点击「开始采集」获取内容" : "尝试调整筛选条件后重新搜索"}
                className="h-48"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {managementMode && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) => {
                            if (checked) selectAll();
                            else deselectAll();
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>标题</TableHead>
                    <TableHead className="w-24">来源</TableHead>
                    <TableHead className="w-32 hidden md:table-cell">文章发布时间</TableHead>
                    <TableHead className="w-32 hidden md:table-cell">采集时间</TableHead>
                    <TableHead className="w-16">AI</TableHead>
                    {managementMode && <TableHead className="w-24">操作</TableHead>}
                    <TableHead className="w-14 hidden md:table-cell">字数</TableHead>
                    {showDebugCols && <TableHead className="w-24">Owner</TableHead>}
                    {showDebugCols && <TableHead className="w-20">可见性</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setDetailItem(item)}
                    >
                      {managementMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium max-w-[180px] md:max-w-[280px] truncate">
                        <div className="flex items-center gap-1.5">
                          {item.userRead && (
                            <span title="已读" className="shrink-0">
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            </span>
                          )}
                          {item.userBookmarked && (
                            <span title="已收藏" className="shrink-0">
                              <BookmarkCheck className="h-3.5 w-3.5 text-yellow-500" />
                            </span>
                          )}
                          {item.userIgnored && (
                            <span title="已忽略" className="shrink-0">
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </span>
                          )}
                          <Button
                            variant="link"
                            className="w-full truncate text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailItem(item);
                            }}
                          >
                            {item.title}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.source?.name ?? item.platform ?? "未知来源"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {formatDateTime(item.publishedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {item.aiDecision === "accept" ? (
                            <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">通过</Badge>
                          ) : item.aiDecision === "reject" ? (
                            <Badge variant="destructive" className="text-xs">拒绝</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-400">未评估</Badge>
                          )}
                          {item.contentGenre && (
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${GENRE_BADGE_COLORS[item.contentGenre] ?? "bg-gray-100 text-gray-500"}`}
                            >
                              {CONTENT_GENRE_LABELS[item.contentGenre] ?? item.contentGenre}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {managementMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {item.adminReviewStatus === "approved" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => pushFeature(item.id, item.title)}
                              title="推送至今日推荐"
                            >
                              <Star className="mr-1 h-3.5 w-3.5" />
                              推荐
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {item.effectiveTextLength ?? "-"}
                      </TableCell>
                      {showDebugCols && (
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          {item.ownerUserId ? item.ownerUserId.slice(0, 8) + "…" : "null"}
                        </TableCell>
                      )}
                      {showDebugCols && (
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {item.visibility ?? "null"}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>

        {/* Detail panel */}
        {detailItem && (
          <div className="w-full md:w-1/2 border-l overflow-hidden fixed md:relative inset-0 md:inset-auto z-50 md:z-auto bg-background">
            <ArticleDetail
              article={detailItem}
              managementMode={managementMode}
              onClose={() => setDetailItem(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
