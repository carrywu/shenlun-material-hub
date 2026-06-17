"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
  FileText,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Highlighter,
  MessageSquarePlus,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ArticleContentRenderer } from "@/components/articles/ArticleContentRenderer";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_GENRE_LABELS,
  getAiAssessmentSourceLabel,
  getAiDecisionLabel,
  translateTag,
  parseTopicTags,
} from "@/lib/display-labels";
import type { CardType } from "@/types";

interface Annotation {
  id: string;
  contentItemId: string;
  cardType: string | null;
  selectedText: string;
  comment: string;
  color: string;
  startOffset: number | null;
  endOffset: number | null;
  paragraph: number | null;
  createdAt: string;
}

interface ArticleDetail {
  id: string;
  title: string;
  originalUrl: string;
  platform: string;
  fullText: string | null;
  rawHtml: string | null;
  excerpt: string | null;
  contentType: string;
  topicTags: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  processingStatus: string;
  qualityStatus: string;
  aiScore: number | null;
  aiDecision: string | null;
  aiReason: string | null;
  aiCategories: string | null;
  aiUsableFor: string | null;
  aiSummary: string | null;
  aiQuotes: string | null;
  contentGenre: string | null;
  aiAssessedAt: string | null;
  aiAssessmentSource?: string | null;
  aiAssessmentModel?: string | null;
  aiPromptVersion?: string | null;
  aiContentHash?: string | null;
  aiLastError?: string | null;
  aiLastFailedAt?: string | null;
  aiAssessmentError?: string | null;
  aiScoreDetail: string | null;
  aiScoredAt: string | null;
  contentHash?: string | null;
  adminReviewStatus: string;
  effectiveTextLength: number;
  bookmarked: boolean;
  read: boolean;
  ignored: boolean;
  userRead?: boolean;
  userIgnored?: boolean;
  userBookmarked?: boolean;
  source?: { id: string; name: string; platform: string } | null;
  materialCards: Array<{
    id: string;
    title: string;
    cardType: string;
    aiSummary: string | null;
    confirmed: boolean;
    createdAt: string;
  }>;
  annotations: Annotation[];
}

/** 批注 tooltip：使用 portal 挂载到 body，fixed 定位，跟随鼠标并自动避让视口边缘。
 *  全程不调用 setState：初始位置用 CSS 隐藏，mousemove 直接操作 DOM 位移，
 *  避免高频重渲染，也避开 effect 内同步 setState 的 lint 报错。 */
function AnnotationTooltip({ comment, visible }: { comment: string; visible: boolean }) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const handleMouseMove = (e: MouseEvent) => {
      const el = elRef.current;
      if (!el) return;
      const pad = 12;
      const tooltipW = 256;
      const tooltipH = 80;
      let top = e.clientY - tooltipH - pad;
      let left = e.clientX - tooltipW / 2;
      if (top < pad) top = e.clientY + pad;
      if (left < pad) left = pad;
      if (left + tooltipW > window.innerWidth - pad) left = window.innerWidth - tooltipW - pad;
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.opacity = "1";
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={elRef}
      style={{
        position: "fixed",
        top: -200,
        left: -200,
        opacity: 0,
        zIndex: 9999,
        transition: "opacity 0.05s",
      }}
      className="w-64 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border pointer-events-none"
      role="tooltip"
    >
      <span className="font-medium block mb-1">批注：</span>
      {comment}
    </div>,
    document.body,
  );
}

const CARD_TYPE_CONFIG: Record<string, { label: string }> = {
  golden_sentence: { label: "申论金句" },
  standard_expression: { label: "规范词" },
  case_material: { label: "案例素材" },
  countermeasure: { label: "对策表达" },
  problem_statement: { label: "问题表述" },
  reason_analysis: { label: "原因分析" },
  policy_expression: { label: "政策表述" },
  data_fact: { label: "案例素材" },
  person_story: { label: "人物事迹" },
  article_structure: { label: "文章框架" },
  // Legacy types fallback
  fact_summary: { label: "案例素材" },
  argument_analysis: { label: "原因分析" },
  data_highlight: { label: "案例素材" },
  policy_compare: { label: "政策表述" },
  case_study: { label: "案例素材" },
};

const GENERATE_CARD_TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
  { value: "golden_sentence", label: "申论金句" },
  { value: "standard_expression", label: "规范词" },
  { value: "case_material", label: "案例素材" },
  { value: "countermeasure", label: "对策表达" },
  { value: "problem_statement", label: "问题表述" },
  { value: "reason_analysis", label: "原因分析" },
  { value: "policy_expression", label: "政策表述" },
  { value: "person_story", label: "人物事迹" },
  { value: "article_structure", label: "文章框架" },
];

function parseStringList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
  } catch {
    return value
      .split(/[\n,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function AiEvaluationPanel({
  article,
  showDebugInfo,
  showHashDebugInfo,
}: {
  article: ArticleDetail;
  showDebugInfo: boolean;
  showHashDebugInfo: boolean;
}) {
  const categories = parseStringList(article.aiCategories);
  const usableFor = parseStringList(article.aiUsableFor);
  const quotes = parseStringList(article.aiQuotes);
  // 解析评分详情（5 维度：relevance/quality/freshness/uniqueness/usability）
  const scoreDetail: Record<string, number> | null = (() => {
    if (!article.aiScoreDetail) return null;
    try {
      const parsed = JSON.parse(article.aiScoreDetail);
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  })();
  const scoreLabels: Record<string, string> = {
    relevance: "相关性",
    quality: "质量",
    freshness: "时效性",
    uniqueness: "独特性",
    usability: "可用性",
  };
  const hasEvaluation = Boolean(
    article.aiAssessedAt ||
    article.aiDecision ||
    article.aiScore !== null ||
    article.aiSummary ||
    article.aiReason
  );
  const decisionLabel = getAiDecisionLabel(article.aiDecision);
  // 判断评估是否过期：只看正文 hash 是否变化（评估时记录的 aiContentHash vs 当前 contentHash）。
  // 不能用 updatedAt 判断——任何无关 UPDATE（收藏/阅读/批注/重新评估本身）都会刷新
  // ContentItem.updatedAt，导致 updatedAt 永远 >= aiAssessedAt，从而误报"评估过期"。
  // hash 才是正文是否真的变化的可靠依据。
  const hashStale = Boolean(article.aiContentHash && article.contentHash && article.aiContentHash !== article.contentHash);
  const stale = hasEvaluation && hashStale;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm">AI 评估结果</CardTitle>
            {article.aiAssessedAt && (
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {new Date(article.aiAssessedAt).toLocaleString("zh-CN")}
              </span>
            )}
          </div>
          <Badge
            variant={article.aiDecision === "accept" ? "default" : article.aiDecision === "reject" ? "destructive" : "secondary"}
            className="text-xs"
          >
            {decisionLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {article.aiScore !== null && (
          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-semibold tabular-nums">
                {article.aiScore.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">/ 10 综合评分</span>
            </div>
            {scoreDetail && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {Object.entries(scoreDetail).map(([dim, val]) => (
                  <div key={dim} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {scoreLabels[dim] ?? dim}
                    </span>
                    <span className="tabular-nums font-medium">
                      {typeof val === "number" ? val.toFixed(1) : val}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!hasEvaluation && !article.aiLastError && (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-muted-foreground">
            尚未评估。请点击重新评估后再查看 AI 结论。
          </div>
        )}
        {!hasEvaluation && article.aiLastError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            <p className="font-medium">评估失败：{article.aiLastError}</p>
            <p className="text-xs mt-1">请检查您的 AI 配置后点击重新评估。</p>
          </div>
        )}
        {stale && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800">
            评估可能已过期，请重新评估。
          </div>
        )}
        {article.aiLastError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            最近一次重新评估失败：{article.aiLastError}
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">AI 摘要</p>
          <p className="leading-relaxed whitespace-pre-wrap">{article.aiSummary || "暂无 AI 摘要"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">判定理由</p>
          <p className="leading-relaxed whitespace-pre-wrap">{article.aiReason || "暂无判定理由"}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">主题分类</p>
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((item) => <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>)}
              </div>
            ) : (
              <p className="text-muted-foreground">暂无主题分类</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">可用场景</p>
            {usableFor.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {usableFor.map((item) => <Badge key={item} variant="outline" className="text-xs">{item}</Badge>)}
              </div>
            ) : (
              <p className="text-muted-foreground">暂无可用场景</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">金句预览</p>
          {quotes.length > 0 ? (
            <div className="space-y-1.5">
              {quotes.map((quote, index) => (
                <p key={`${quote}-${index}`} className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed">
                  {quote}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">暂无金句预览</p>
          )}
        </div>
        {showDebugInfo && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">AI 评估调试信息</p>
            <p>数据来源：{getAiAssessmentSourceLabel(article.aiAssessmentSource)}</p>
            <p>评估时间：{article.aiAssessedAt ? new Date(article.aiAssessedAt).toLocaleString("zh-CN") : "无"}</p>
            <p>模型：{article.aiAssessmentModel || "未记录"}</p>
            <p>Prompt 版本：{article.aiPromptVersion || "未记录"}</p>
            <p>文章 ID：{article.id}</p>
            {showHashDebugInfo && (
              <>
                <p>评估正文 hash：{article.aiContentHash || "未记录"}</p>
                <p>当前正文 hash：{article.contentHash || "未记录"}</p>
              </>
            )}
            {article.aiLastFailedAt && (
              <p>最近失败时间：{new Date(article.aiLastFailedAt).toLocaleString("zh-CN")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;
  const { isAdmin, isVerifiedUser, user } = useAuth();

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardType, setCardType] = useState<CardType>("golden_sentence");
  const [generatingCard, setGeneratingCard] = useState(false);
  const [syncingToIma, setSyncingToIma] = useState(false);

  // Annotation state
  const [selectedText, setSelectedText] = useState("");
  const [annotationComment, setAnnotationComment] = useState("");
  const [annotating, setAnnotating] = useState(false);
  const [autoAnnotating, setAutoAnnotating] = useState(false);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);

  const textRef = useRef<HTMLDivElement>(null);

  const fetchArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-items/${articleId}`);
      if (!res.ok) throw new Error("请求失败");
      const data = await res.json();
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArticle();
  }, [fetchArticle]);

  // Image load error capture
  useEffect(() => {
    const container = textRef.current;
    if (!container) return;

    const handleError = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        const img = target as HTMLImageElement;
        if (img.dataset.failed) return;
        img.dataset.failed = "true";
        
        const parent = img.parentNode;
        if (parent) {
          const placeholder = document.createElement("div");
          placeholder.className = "flex items-center justify-center p-4 bg-muted border rounded-md text-xs text-muted-foreground my-4";
          placeholder.innerText = "🖼️ 图片加载失败";
          parent.replaceChild(placeholder, img);
        }
      }
    };

    container.addEventListener("error", handleError, true);
    return () => {
      container.removeEventListener("error", handleError, true);
    };
  }, [article?.rawHtml]);

  // Handle text selection for annotation
  function handleTextSelection() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
      setShowAnnotationForm(true);
    }
  }

  // Create manual annotation
  async function handleCreateAnnotation() {
    if (!selectedText || !annotationComment || annotating) return;
    setAnnotating(true);
    try {
      const res = await fetch(`/api/content-items/${articleId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          comment: annotationComment,
          useAI: false,
        }),
      });
      if (!res.ok) throw new Error("创建批注失败");
      setSelectedText("");
      setAnnotationComment("");
      setShowAnnotationForm(false);
      fetchArticle();
    } catch {
      toast.error("创建批注失败", { description: "请稍后重试" });
    } finally {
      setAnnotating(false);
    }
  }

  // AI auto-annotate entire article
  async function handleAutoAnnotate() {
    if (autoAnnotating) return;
    setAutoAnnotating(true);
    try {
      const res = await fetch(`/api/content-items/${articleId}/annotations`, {
        method: "PUT",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "自动批注失败");
      }
      fetchArticle();
    } catch {
      toast.error("自动批注失败", { description: "请检查 AI 配置或稍后重试" });
    } finally {
      setAutoAnnotating(false);
    }
  }

  // AI annotate selected text
  async function handleAIAnnotateSelection() {
    if (!selectedText || annotating) return;
    setAnnotating(true);
    try {
      const res = await fetch(`/api/content-items/${articleId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          useAI: true,
        }),
      });
      if (!res.ok) throw new Error("AI 批注失败");
      setSelectedText("");
      setShowAnnotationForm(false);
      fetchArticle();
    } catch {
      toast.error("AI 批注失败", { description: "请稍后重试" });
    } finally {
      setAnnotating(false);
    }
  }

  async function handleDeleteAnnotation(annotationId: string) {
    setDeletingAnnotationId(annotationId);
    try {
      const res = await fetch(`/api/annotations/${annotationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除批注失败");
      fetchArticle();
    } catch {
      toast.error("删除批注失败");
    } finally {
      setDeletingAnnotationId(null);
    }
  }

  async function handleUpdateAnnotation(annotationId: string) {
    if (!editComment.trim()) return;
    try {
      const res = await fetch(`/api/annotations/${annotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: editComment }),
      });
      if (!res.ok) throw new Error("更新批注失败");
      setEditingAnnotationId(null);
      setEditComment("");
      fetchArticle();
    } catch {
      toast.error("更新批注失败");
    }
  }

  function scrollToAnnotation(annotationId: string) {
    const el = document.querySelector(`[data-annotation-id="${annotationId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function toggleReadingState(field: "bookmarked" | "read" | "ignored") {
    if (!article) return;
    const newValue = !article[field];
    try {
      const res = await fetch(`/api/content-items/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (res.ok) {
        setArticle((prev) => prev ? { ...prev, [field]: newValue } : prev);
      }
    } catch {
      // ignore
    }
  }

  async function handleGenerateCard() {
    if (!article || generatingCard) return;
    setGeneratingCard(true);
    try {
      const res = await fetch(`/api/content-items/${articleId}/generate-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.message || data.error || "素材卡生成失败";
        if (data.code === "AI_CONFIG_MISSING" || data.code === "AI_CONFIG_DECRYPT_FAILED") {
          toast.error(message, {
            description: "请先检查个人 AI 配置。",
            action: {
              label: "去配置",
              onClick: () => router.push("/settings/ai"),
            },
          });
        } else {
          toast.error(message);
        }
        return;
      }

      const task = Array.isArray(data.tasks) ? data.tasks[0] : null;
      if (task?.duplicated) {
        toast.info("该类型素材卡已存在", { description: "可在右侧已生成素材卡中查看。" });
        return;
      }

      toast.success("素材卡生成任务已提交", { description: "稍后会出现在右侧已生成素材卡列表中。" });
      setTimeout(() => {
        fetchArticle();
      }, 2000);
    } catch {
      toast.error("素材卡生成请求失败", { description: "请检查网络后重试。" });
    } finally {
      setGeneratingCard(false);
    }
  }

  async function handleSyncArticleToIma() {
    if (!article || syncingToIma) return;
    setSyncingToIma(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/sync-to-ima`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        const message = data.errorMessage || data.error || "同步到 IMA 失败";
        if (data.errorCode === "IMA_CONFIG_MISSING") {
          toast.error(message, {
            action: {
              label: "去配置",
              onClick: () => router.push("/settings/ima"),
            },
          });
        } else {
          toast.error(message);
        }
        return;
      }

      const description = data.imaDocumentId
        ? `IMA 文档 ID：${data.imaDocumentId}`
        : data.syncedAt
          ? `同步时间：${new Date(data.syncedAt).toLocaleString("zh-CN")}`
          : undefined;
      toast.success(data.message || "已同步到 IMA", { description });
    } catch {
      toast.error("同步到 IMA 请求失败，请检查网络后重试");
    } finally {
      setSyncingToIma(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">{error ?? "文章不存在"}</p>
        <Button variant="outline" onClick={() => router.push("/articles")}>
          返回列表
        </Button>
      </div>
    );
  }

  const tags = parseTopicTags(article.topicTags);
  const canGenerateCard = isVerifiedUser && !isAdmin;
  const generateDisabledReason = !article.fullText
    ? "该文章暂无全文，无法生成素材卡。"
    : article.adminReviewStatus !== "approved"
      ? "该文章尚未通过管理员审核，无法生成素材卡。"
      : null;

  const scoreDetail = article.aiScoreDetail
    ? (() => { try { return JSON.parse(article.aiScoreDetail); } catch { return null; } })()
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push("/articles")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="ml-1">返回列表</span>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold break-words leading-snug">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{article.source?.name ?? article.platform}</span>
                {article.publishedAt && (
                  <>
                    <span>·</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString("zh-CN")}</span>
                  </>
                )}
                {article.contentGenre && (
                  <Badge variant="secondary" className="text-xs">
                    {CONTENT_GENRE_LABELS[article.contentGenre] ?? article.contentGenre}
                  </Badge>
                )}
                {article.aiScore !== null && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      article.aiScore >= 7
                        ? "border-green-500 text-green-600"
                        : article.aiScore >= 5
                          ? "border-amber-500 text-amber-600"
                          : ""
                    }`}
                  >
                    评分 {article.aiScore}
                  </Badge>
                )}
                {article.userRead && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" /> 已读
                  </Badge>
                )}
                {article.userBookmarked && (
                  <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 hover:bg-yellow-50">
                    <BookmarkCheck className="h-3 w-3 mr-1" /> 已收藏
                  </Badge>
                )}
                {article.userIgnored && (
                  <Badge variant="secondary" className="text-xs opacity-50 hover:opacity-50">
                    <EyeOff className="h-3 w-3 mr-1" /> 已忽略
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Reading state toggles */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleReadingState("bookmarked")}
              title={article.bookmarked ? "取消收藏" : "收藏"}
            >
              {article.bookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-yellow-500" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleReadingState("read")}
              title={article.read ? "标记未读" : "标记已读"}
            >
              {article.read ? (
                <Eye className="h-4 w-4 text-green-500" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <a
              href={article.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              查看原文
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncArticleToIma}
              disabled={syncingToIma}
            >
              {syncingToIma ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {syncingToIma ? "同步中..." : "同步到 IMA"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {translateTag(tag)}
                  </Badge>
                ))}
              </div>
            )}

            {/* AI Score Detail */}
            {scoreDetail && (
              <div className="rounded-md bg-muted/50 p-3 space-y-2">
                <p className="text-sm font-medium">AI 评分详情</p>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { key: "relevance", label: "相关度" },
                    { key: "quality", label: "质量" },
                    { key: "freshness", label: "时效性" },
                    { key: "uniqueness", label: "独特性" },
                    { key: "usability", label: "可用性" },
                  ].map((dim) => (
                    <div key={dim.key}>
                      <p className="text-lg font-bold">{scoreDetail[dim.key] ?? "-"}</p>
                      <p className="text-[10px] text-muted-foreground">{dim.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Excerpt */}
            {article.excerpt && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium mb-1">摘要</p>
                <p className="text-sm text-muted-foreground">{article.excerpt}</p>
              </div>
            )}

            {article.fullText && (article.fullText.startsWith("<!DOCTYPE html") || article.fullText.includes("<html") || article.fullText.includes("<head>")) && (
              <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  ⚠️ 该文章正文疑似未清洗，建议重新解析或运行修复脚本。
                </p>
                <p>前端已做临时清洗以避免页面卡死，但 AI 评估和素材卡生成可能仍不正常。</p>
              </div>
            )}

            <AiEvaluationPanel
              article={article}
              showDebugInfo={isAdmin || process.env.NODE_ENV !== "production"}
              showHashDebugInfo={isAdmin}
            />

            {/* Full text with annotations */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">正文</CardTitle>
                  <div className="flex items-center gap-2">
                    {article.annotations && article.annotations.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {article.annotations.length} 条批注
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={textRef}>
                  <ArticleContentRenderer
                    platform={article.platform}
                    rawHtml={article.rawHtml}
                    fullText={article.fullText}
                    sourceUrl={article.originalUrl}
                    annotations={article.annotations.length > 0 ? article.annotations : undefined}
                    onMouseUp={handleTextSelection}
                    onImageClick={setPreviewImageUrl}
                    onAnnotationHover={setHoveredAnnotation}
                  />
                </div>
                {/* Portal tooltip for annotations — placed outside overflow containers */}
                <AnnotationTooltip
                  comment={hoveredAnnotation?.comment ?? ""}
                  visible={!!hoveredAnnotation}
                />
              </CardContent>
            </Card>

            {/* Annotation form — admin only */}
            {isAdmin && showAnnotationForm && selectedText && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Highlighter className="h-4 w-4 text-yellow-600" />
                    新建批注
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
                    <span className="font-medium">选中文本：</span>
                    <span className="line-clamp-3">{selectedText}</span>
                  </div>
                  <Textarea
                    placeholder="输入批注内容..."
                    value={annotationComment}
                    onChange={(e) => setAnnotationComment(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateAnnotation}
                      disabled={!annotationComment || annotating}
                    >
                      {annotating ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      手动批注
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAIAnnotateSelection}
                      disabled={annotating}
                    >
                      {annotating ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      AI 批注
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAnnotationForm(false);
                        setSelectedText("");
                        setAnnotationComment("");
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">快捷操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isAdmin ? (
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
                    <p>当前页面为公开阅读视图。</p>
                    <Link href="/admin/articles" className="underline">
                      前往后台文章管理
                    </Link>
                  </div>
                ) : canGenerateCard ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      使用你的个人 AI 配置生成私有素材卡。
                    </p>
                    <Select
                      value={cardType}
                      onValueChange={(value) => setCardType(value as CardType)}
                    >
                      <SelectTrigger className="h-8 text-xs" aria-label="素材卡类型">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENERATE_CARD_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleGenerateCard}
                      disabled={generatingCard || !!generateDisabledReason}
                      size="sm"
                      className="w-full text-xs"
                    >
                      {generatingCard ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CreditCard className="h-3 w-3 mr-1" />
                      )}
                      生成素材卡
                    </Button>
                    {generateDisabledReason ? (
                      <p className="text-[10px] text-muted-foreground text-center">
                        {generateDisabledReason}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground text-center">
                        生成后可在素材卡页复习和确认。
                      </p>
                    )}
                    <Link href="/settings/ai" className="block text-center text-[10px] underline text-muted-foreground">
                      管理个人 AI 配置
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
                    <p>升级为认证用户后可使用个人 AI 配置生成素材卡。</p>
                    <Link href="/settings/account" className="underline">
                      去账号设置升级
                    </Link>
                    {user?.role && (
                      <p className="text-[10px]">当前角色：{user.role}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">
                      AI 评估由管理员在后台完成。
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Annotations list — admin only */}
            {isAdmin && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>文章批注</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {article.annotations?.length ?? 0}
                    </Badge>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleAutoAnnotate}
                    disabled={autoAnnotating || !article.fullText}
                  >
                    {autoAnnotating ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    AI 自动批注
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!article.annotations || article.annotations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    暂无批注，选中文本或使用 AI 自动批注
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-auto">
                    {article.annotations.map((annotation) => (
                      <div
                        key={annotation.id}
                        className="p-2 rounded-md border hover:bg-muted/50 group cursor-pointer"
                        onClick={() => scrollToAnnotation(annotation.id)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground truncate">
                              「{annotation.selectedText.slice(0, 50)}
                              {annotation.selectedText.length > 50 ? "..." : ""}」
                            </p>
                            {editingAnnotationId === annotation.id ? (
                              <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                                <Textarea
                                  value={editComment}
                                  onChange={(e) => setEditComment(e.target.value)}
                                  rows={2}
                                  className="text-xs"
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px]"
                                    onClick={() => handleUpdateAnnotation(annotation.id)}
                                  >
                                    保存
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px]"
                                    onClick={() => {
                                      setEditingAnnotationId(null);
                                      setEditComment("");
                                    }}
                                  >
                                    取消
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs mt-1">{annotation.comment}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAnnotationId(annotation.id);
                                setEditComment(annotation.comment);
                              }}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAnnotation(annotation.id);
                              }}
                              disabled={deletingAnnotationId === annotation.id}
                            >
                              {deletingAnnotationId === annotation.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(annotation.createdAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Material cards list */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>已生成素材卡</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {article.materialCards.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {article.materialCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无素材卡</p>
                ) : (
                  <div className="space-y-2">
                    {article.materialCards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/cards/${card.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{card.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {CARD_TYPE_CONFIG[card.cardType]?.label ?? card.cardType}
                            {card.confirmed && " · 已确认"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">元数据</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>来源：{article.source?.name ?? article.platform}</p>
                <p>类型：{article.contentType ? (CONTENT_TYPE_LABELS[article.contentType] ?? article.contentType) : "未分类"}</p>
                <p>字数：{article.effectiveTextLength}</p>
                <p>AI 状态：{getAiDecisionLabel(article.aiDecision)}</p>
                <Separator className="my-2" />
                <p>创建时间：{new Date(article.createdAt).toLocaleString("zh-CN")}</p>
                <p>ID：{article.id}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center">
            <button
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-sm flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md transition-colors"
              onClick={() => setPreviewImageUrl(null)}
            >
              <X className="h-4 w-4" /> 关闭
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt="微信正文图片预览"
              className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl border border-white/10 select-none cursor-zoom-out"
            />
          </div>
        </div>
      )}
    </div>
  );
}
