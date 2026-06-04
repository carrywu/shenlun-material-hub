"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CheckCircle2,
  Edit3,
  FileText,
  BarChart3,
  BookOpen,
  Lightbulb,
  Trash2,
  Sparkles,
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
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  golden_sentence: { label: "申论金句", icon: Sparkles, color: "bg-yellow-500" },
  standard_expression: { label: "规范词", icon: FileText, color: "bg-blue-500" },
  case_material: { label: "案例素材", icon: Lightbulb, color: "bg-teal-500" },
  countermeasure: { label: "对策表达", icon: BookOpen, color: "bg-green-500" },
  problem_statement: { label: "问题表述", icon: BarChart3, color: "bg-red-500" },
  reason_analysis: { label: "原因分析", icon: BookOpen, color: "bg-purple-500" },
  policy_expression: { label: "政策表述", icon: FileText, color: "bg-orange-500" },
  data_fact: { label: "案例素材", icon: Lightbulb, color: "bg-teal-500" },
  person_story: { label: "人物事迹", icon: Lightbulb, color: "bg-pink-500" },
  article_structure: { label: "文章框架", icon: BookOpen, color: "bg-indigo-500" },
  // Legacy fallback
  fact_summary: { label: "案例素材", icon: Lightbulb, color: "bg-teal-500" },
  argument_analysis: { label: "原因分析", icon: BookOpen, color: "bg-purple-500" },
  data_highlight: { label: "案例素材", icon: Lightbulb, color: "bg-teal-500" },
  policy_compare: { label: "政策表述", icon: FileText, color: "bg-orange-500" },
  case_study: { label: "案例素材", icon: Lightbulb, color: "bg-teal-500" },
};

import { AI_FIELD_LABELS } from "@/lib/display-labels";

function formatAiValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function renderObjectEntries(item: Record<string, unknown>) {
  const knownEntries = Object.entries(item).filter(([key]) => AI_FIELD_LABELS[key]);
  const unknownEntries = Object.entries(item).filter(([key]) => !AI_FIELD_LABELS[key]);
  const entries = [
    ...knownEntries,
    ...(unknownEntries.length > 0 ? [["otherInfo", unknownEntries.map(([, value]) => formatAiValue(value)).filter(Boolean).join("\n")]] as [string, unknown][] : []),
  ];

  return entries.map(([k, v]) => (
    <div key={k} className="grid grid-cols-[80px_1fr] gap-2 border-b border-muted last:border-b-0 pb-1.5 last:pb-0">
      <span className="font-semibold text-muted-foreground">{k === "otherInfo" ? "其他信息" : AI_FIELD_LABELS[k]}：</span>
      <span className="text-foreground whitespace-pre-wrap">{formatAiValue(v)}</span>
    </div>
  ));
}

function renderContent(content: string) {
  if (!content) return null;
  const trimmed = content.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return (
          <div className="space-y-3 mt-1.5">
            {parsed.map((item, idx) => (
              <div key={idx} className="p-2.5 rounded-md bg-white dark:bg-muted/20 border border-border/60 text-xs space-y-1.5 shadow-sm">
                {typeof item === "object" && item !== null ? (
                  renderObjectEntries(item as Record<string, unknown>)
                ) : (
                  <span className="text-foreground whitespace-pre-wrap">{String(item)}</span>
                )}
              </div>
            ))}
          </div>
        );
      } else if (typeof parsed === "object" && parsed !== null) {
        return (
          <div className="p-2.5 rounded-md bg-white dark:bg-muted/20 border border-border/60 text-xs space-y-1.5 mt-1.5 shadow-sm">
            {renderObjectEntries(parsed as Record<string, unknown>)}
          </div>
        );
      }
    } catch {
      // Fallback
    }
  }
  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>;
}

const COLOR_THEMES: Record<string, { border: string; bg: string; text: string; bar: string }> = {
  "来源快照": { border: "border-blue-100 dark:border-blue-900/40", bg: "bg-blue-50/40 dark:bg-blue-950/10", text: "text-blue-900 dark:text-blue-200", bar: "bg-blue-500" },
  "原始事实": { border: "border-slate-200 dark:border-slate-800", bg: "bg-slate-50/50 dark:bg-slate-900/10", text: "text-slate-900 dark:text-slate-200", bar: "bg-slate-500" },
  "亮点建议": { border: "border-amber-100 dark:border-amber-900/40", bg: "bg-amber-50/40 dark:bg-amber-950/10", text: "text-amber-900 dark:text-amber-200", bar: "bg-amber-505 bg-amber-500" },
  "迁移建议": { border: "border-purple-100 dark:border-purple-900/40", bg: "bg-purple-50/40 dark:bg-purple-950/10", text: "text-purple-900 dark:text-purple-200", bar: "bg-purple-500" },
  "默认": { border: "border-gray-200 dark:border-gray-800", bg: "bg-gray-50/40 dark:bg-gray-900/10", text: "text-gray-900 dark:text-gray-200", bar: "bg-gray-500" },
};

function SectionBlock({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  const theme = COLOR_THEMES[label] ?? COLOR_THEMES["默认"];
  
  return (
    <div className={`p-3 rounded-lg border ${theme.border} ${theme.bg} space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-1 h-3.5 rounded-full ${theme.bar}`} />
        <h4 className={`text-xs font-semibold tracking-wide ${theme.text}`}>{label}</h4>
      </div>
      <div className="pl-3">
        {renderContent(content)}
      </div>
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
  const config = CARD_TYPE_CONFIG[cardType] ?? CARD_TYPE_CONFIG.golden_sentence;
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
          <SectionBlock label="迁移建议" content={transferSuggestions} />
        )}
      </CardContent>
    </Card>
  );
}
