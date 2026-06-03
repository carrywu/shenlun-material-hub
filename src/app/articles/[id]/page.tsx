"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  ExternalLink,
  CreditCard,
  Loader2,
  FileText,
  BookOpen,
  BarChart3,
  GitCompare,
  Lightbulb,
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Highlighter,
  MessageSquarePlus,
} from "lucide-react";
import type { CardType } from "@/types";
import { formatApiErrorMessage, type ApiErrorPayload } from "@/lib/api-error";

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
  excerpt: string | null;
  contentType: string;
  topicTags: string;
  publishedAt: string | null;
  createdAt: string;
  processingStatus: string;
  qualityStatus: string;
  aiScore: number | null;
  aiDecision: string | null;
  aiReason: string | null;
  contentGenre: string | null;
  aiAssessedAt: string | null;
  aiScoreDetail: string | null;
  aiScoredAt: string | null;
  effectiveTextLength: number;
  bookmarked: boolean;
  read: boolean;
  ignored: boolean;
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

const CARD_TYPE_OPTIONS: { value: CardType; label: string; icon: React.ElementType }[] = [
  { value: "fact_summary", label: "事实摘要", icon: FileText },
  { value: "argument_analysis", label: "论点分析", icon: BookOpen },
  { value: "data_highlight", label: "数据亮点", icon: BarChart3 },
  { value: "policy_compare", label: "政策对比", icon: GitCompare },
  { value: "case_study", label: "案例研究", icon: Lightbulb },
];

const CARD_TYPE_CONFIG: Record<string, { label: string }> = {
  fact_summary: { label: "事实摘要" },
  argument_analysis: { label: "论点分析" },
  data_highlight: { label: "数据亮点" },
  policy_compare: { label: "政策对比" },
  case_study: { label: "案例研究" },
};

const CONTENT_GENRE_LABELS: Record<string, string> = {
  commentary: "评论",
  policy_interpretation: "政策解读",
  case_practice: "案例实践",
  ordinary_news: "普通新闻",
  meeting_news: "会议新闻",
  notice: "通知公告",
  other: "其他",
};

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardType, setCardType] = useState<CardType>("fact_summary");
  const [generating, setGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; code?: string } | null>(null);

  // Annotation state
  const [selectedText, setSelectedText] = useState("");
  const [annotationComment, setAnnotationComment] = useState("");
  const [annotating, setAnnotating] = useState(false);
  const [autoAnnotating, setAutoAnnotating] = useState(false);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArticle();
  }, [fetchArticle]);

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
      alert("创建批注失败，请稍后重试");
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
      alert("自动批注失败，请检查 AI 配置或稍后重试");
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
      alert("AI 批注失败，请稍后重试");
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
      alert("删除批注失败");
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
      alert("更新批注失败");
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

  // Generate card
  async function handleGenerateCard() {
    if (generating || !article) return;
    setGenerating(true);
    setErrorInfo(null);
    try {
      const res = await fetch(`/api/content-items/${article.id}/generate-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardType }),
      });
      const data = (await res.json()) as ApiErrorPayload;
      if (!res.ok) {
        setErrorInfo({ message: formatApiErrorMessage(data), code: data.code });
        return;
      }
      fetchArticle();
    } catch {
      setErrorInfo({ message: "网络错误，请检查连接后重试" });
    } finally {
      setGenerating(false);
    }
  }

  // Render text with annotation highlights
  function renderAnnotatedText() {
    if (!article?.fullText) return "暂无正文，请重新采集或查看原文";

    const text = article.fullText;
    const annotations = article.annotations ?? [];

    if (annotations.length === 0) return text;

    // Sort annotations by position in text
    const sortedAnnotations = [...annotations]
      .map((a) => ({
        ...a,
        index: text.indexOf(a.selectedText),
      }))
      .filter((a) => a.index >= 0)
      .sort((a, b) => a.index - b.index);

    if (sortedAnnotations.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((annotation, i) => {
      // Add text before this annotation
      if (annotation.index > lastIndex) {
        parts.push(
          <span key={`text-${i}`}>
            {text.slice(lastIndex, annotation.index)}
          </span>
        );
      }

      parts.push(
        <span
          key={`annotation-${annotation.id}`}
          data-annotation-id={annotation.id}
          className="relative group cursor-pointer scroll-mt-20"
          style={{
            backgroundColor: annotation.color + "40",
            borderBottom: `2px solid ${annotation.color}`,
          }}
          title={annotation.comment}
        >
          {annotation.selectedText}
          <span className="absolute bottom-full left-0 hidden group-hover:block z-10 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border">
            <span className="font-medium block mb-1">批注：</span>
            {annotation.comment}
          </span>
        </span>
      );

      lastIndex = annotation.index + annotation.selectedText.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return parts;
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

  const tags = article.topicTags
    ? (() => { try { return JSON.parse(article.topicTags); } catch { return []; } })()
    : [];

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
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{article.title}</h1>
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
                    {tag}
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
                <div
                  ref={textRef}
                  className="text-sm leading-relaxed whitespace-pre-wrap select-text"
                  onMouseUp={handleTextSelection}
                >
                  {renderAnnotatedText()}
                </div>
              </CardContent>
            </Card>

            {/* Annotation form */}
            {showAnnotationForm && selectedText && (
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
            {/* Generate card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">生成素材卡</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={cardType}
                  onValueChange={(v) => { if (v) setCardType(v as CardType); }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleGenerateCard}
                  disabled={generating || !article.fullText || article.aiDecision !== "accept"}
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-1.5 h-4 w-4" />
                  )}
                  生成素材卡
                </Button>
                {article.aiDecision !== "accept" && (
                  <p className="text-xs text-muted-foreground">
                    需先通过 AI 评估才能生成素材卡
                  </p>
                )}
                {errorInfo && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm space-y-1">
                    <p>{errorInfo.message}</p>
                    {errorInfo.code === "AI_CONFIG_MISSING" && (
                      <Link href="/settings/ai" className="underline text-xs block">
                        去配置 AI
                      </Link>
                    )}
                    {errorInfo.code === "AI_CONFIG_DECRYPT_FAILED" && (
                      <Link href="/settings/ai" className="underline text-xs block">
                        去重新配置 AI（删除旧配置）
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Annotations list */}
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
                <p>类型：{article.contentType}</p>
                <p>字数：{article.effectiveTextLength}</p>
                <p>AI 状态：{article.aiDecision === "accept" ? "已接受" : article.aiDecision === "reject" ? "已拒绝" : "待评估"}</p>
                <Separator className="my-2" />
                <p>创建时间：{new Date(article.createdAt).toLocaleString("zh-CN")}</p>
                <p>ID：{article.id}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
