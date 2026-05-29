"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Pencil,
  X,
  CreditCard,
  Loader2,
  FileText,
  BookOpen,
  BarChart3,
  GitCompare,
  Lightbulb,
} from "lucide-react";
import type { CardType } from "@/types";

interface ContentItemDetailProps {
  article: {
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
    aiScore: number | null;
    aiScoreDetail: string | null;
    source?: { name: string } | null;
    _count?: { materialCards: number };
  };
  onClose: () => void;
}

const CARD_TYPE_OPTIONS: { value: CardType; label: string; icon: React.ElementType }[] = [
  { value: "fact_summary", label: "事实摘要", icon: FileText },
  { value: "argument_analysis", label: "论点分析", icon: BookOpen },
  { value: "data_highlight", label: "数据亮点", icon: BarChart3 },
  { value: "policy_compare", label: "政策对比", icon: GitCompare },
  { value: "case_study", label: "案例研究", icon: Lightbulb },
];

export function ArticleDetail({ article, onClose }: ContentItemDetailProps) {
  const [cardType, setCardType] = useState<CardType>("fact_summary");
  const [generating, setGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] = useState<{
    id: string;
    cardType: string;
    aiSummary: string | null;
    originalFacts: string | null;
  } | null>(null);

  const tags = article.topicTags
    ? (() => { try { return JSON.parse(article.topicTags); } catch { return []; } })()
    : [];

  const scoreDetail = article.aiScoreDetail
    ? (() => { try { return JSON.parse(article.aiScoreDetail); } catch { return null; } })()
    : null;

  async function handleGenerateCard() {
    if (generating) return;
    setGenerating(true);
    setGeneratedCard(null);

    try {
      const res = await fetch(`/api/content-items/${article.id}/generate-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "生成失败");
      }

      const card = await res.json();
      setGeneratedCard(card);
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成素材卡失败");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1 flex-1 min-w-0">
          <CardTitle className="text-lg leading-snug">{article.title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{article.source?.name ?? article.platform}</span>
            {article.publishedAt && (
              <>
                <span>·</span>
                <span>
                  {new Date(article.publishedAt).toLocaleDateString("zh-CN")}
                </span>
              </>
            )}
            <span>·</span>
            <Badge variant="secondary">{article.contentType}</Badge>
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
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={article.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }))}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <Button variant="ghost" size="icon-xs">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 overflow-auto pt-4 space-y-4">
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

        {article.excerpt && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium mb-1">摘要</p>
            <p className="text-sm text-muted-foreground">{article.excerpt}</p>
          </div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {article.fullText ?? "暂无全文内容"}
        </div>

        {/* Generate Card Section */}
        <Separator />
        <div className="space-y-3">
          <p className="text-sm font-medium">一键生成素材卡</p>
          <div className="flex items-center gap-2">
            <Select
              value={cardType}
              onValueChange={(v) => {
                if (v) setCardType(v as CardType);
              }}
            >
              <SelectTrigger className="flex-1 h-8">
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
              onClick={handleGenerateCard}
              disabled={generating || !article.fullText}
            >
              {generating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-1.5 h-4 w-4" />
              )}
              生成
            </Button>
          </div>

          {/* Generated card preview */}
          {generatedCard && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {CARD_TYPE_OPTIONS.find((o) => o.value === generatedCard.cardType)?.label ?? generatedCard.cardType}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  已生成
                </span>
              </div>
              {generatedCard.originalFacts && (
                <div>
                  <p className="text-xs font-medium mb-1">原始事实</p>
                  <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                    {generatedCard.originalFacts}
                  </p>
                </div>
              )}
              {generatedCard.aiSummary && (
                <div>
                  <p className="text-xs font-medium mb-1">AI 摘要</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {generatedCard.aiSummary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
