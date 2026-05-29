"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CheckCircle2,
  Edit3,
  FileText,
  BarChart3,
  GitCompare,
  BookOpen,
  Lightbulb,
  Trash2,
  ArrowRight,
} from "lucide-react";
import type { CardType } from "@/types";

interface MaterialCardProps {
  id: string;
  title: string;
  cardType: CardType;
  confirmed: boolean;
  sourceSnapshot?: string | null;
  originalFacts?: string | null;
  aiSummary?: string | null;
  highlightSuggestions?: string | null;
  transferSuggestions?: string | null;
  contentItemTitle?: string;
  sourceName?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onConfirm?: (id: string) => void;
}

const CARD_TYPE_CONFIG: Record<
  CardType,
  { label: string; icon: React.ElementType; color: string }
> = {
  fact_summary: { label: "事实摘要", icon: FileText, color: "bg-blue-500" },
  argument_analysis: { label: "论点分析", icon: BookOpen, color: "bg-purple-500" },
  data_highlight: { label: "数据亮点", icon: BarChart3, color: "bg-green-500" },
  policy_compare: { label: "政策对比", icon: GitCompare, color: "bg-orange-500" },
  case_study: { label: "案例研究", icon: Lightbulb, color: "bg-teal-500" },
};

function SectionBlock({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

export function MaterialCardView({
  id,
  title,
  cardType,
  confirmed,
  sourceSnapshot,
  originalFacts,
  aiSummary,
  highlightSuggestions,
  transferSuggestions,
  contentItemTitle,
  sourceName,
  onEdit,
  onDelete,
  onConfirm,
}: MaterialCardProps) {
  const config = CARD_TYPE_CONFIG[cardType] ?? CARD_TYPE_CONFIG.fact_summary;
  const Icon = config.icon;

  return (
    <Card className="relative overflow-hidden">
      {/* Type indicator bar */}
      <div className={`absolute top-0 left-0 w-1 h-full ${config.color}`} />

      <CardHeader className="pb-3 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {confirmed && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <h3 className="font-semibold text-sm leading-tight truncate">
                {title}
              </h3>
            </div>
            {contentItemTitle && (
              <p className="text-xs text-muted-foreground truncate">
                来自：{contentItemTitle}
                {sourceName && ` (${sourceName})`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onEdit(id)}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onConfirm && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onConfirm(id)}
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${confirmed ? "text-green-600" : ""}`}
                />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                onClick={() => onDelete(id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-xs gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pl-5 space-y-3">
        {/* AI Summary */}
        {aiSummary && (
          <div className="flex items-start gap-2">
            <div className="text-sm leading-relaxed">{aiSummary}</div>
          </div>
        )}

        {/* Source Snapshot */}
        {sourceSnapshot && (
          <SectionBlock label="来源快照" content={sourceSnapshot} />
        )}

        {/* Original Facts */}
        {originalFacts && (
          <SectionBlock label="原始事实" content={originalFacts} />
        )}

        {/* Highlight Suggestions */}
        {highlightSuggestions && (
          <SectionBlock label="亮点建议" content={highlightSuggestions} />
        )}

        {/* Transfer Suggestions */}
        {transferSuggestions && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              迁移建议
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {transferSuggestions}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
