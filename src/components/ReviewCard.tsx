"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  ArrowRight,
  BarChart3,
  BookOpen,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { CardType } from "@/types";

interface ReviewCardProps {
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
  onMarkReviewed?: (id: string) => void;
}

const CARD_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  golden_sentence: { label: "申论金句", icon: Sparkles },
  standard_expression: { label: "规范词", icon: FileText },
  case_material: { label: "案例素材", icon: Lightbulb },
  countermeasure: { label: "对策表达", icon: BookOpen },
  problem_statement: { label: "问题表述", icon: BarChart3 },
  reason_analysis: { label: "原因分析", icon: BookOpen },
  policy_expression: { label: "政策表述", icon: FileText },
  data_fact: { label: "案例素材", icon: Lightbulb },
  person_story: { label: "人物事迹", icon: Lightbulb },
  article_structure: { label: "文章框架", icon: BookOpen },
  // Legacy fallback
  fact_summary: { label: "案例素材", icon: Lightbulb },
  argument_analysis: { label: "原因分析", icon: BookOpen },
  data_highlight: { label: "案例素材", icon: Lightbulb },
  policy_compare: { label: "政策表述", icon: FileText },
  case_study: { label: "案例素材", icon: Lightbulb },
};

import { AI_FIELD_LABELS } from "@/lib/display-labels";

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
                  Object.entries(item).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[80px_1fr] gap-2 border-b border-muted last:border-b-0 pb-1.5 last:pb-0">
                      <span className="font-semibold text-muted-foreground">{AI_FIELD_LABELS[k] ?? k}：</span>
                      <span className="text-foreground whitespace-pre-wrap">{String(v)}</span>
                    </div>
                  ))
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
            {Object.entries(parsed).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[80px_1fr] gap-2 border-b border-muted last:border-b-0 pb-1.5 last:pb-0">
                <span className="font-semibold text-muted-foreground">{AI_FIELD_LABELS[k] ?? k}：</span>
                <span className="text-foreground whitespace-pre-wrap">{String(v)}</span>
              </div>
            ))}
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
  "亮点建议": { border: "border-amber-100 dark:border-amber-900/40", bg: "bg-amber-50/40 dark:bg-amber-950/10", text: "text-amber-900 dark:text-amber-200", bar: "bg-amber-500" },
  "迁移建议": { border: "border-purple-100 dark:border-purple-900/40", bg: "bg-purple-50/40 dark:bg-purple-950/10", text: "text-purple-900 dark:text-purple-200", bar: "bg-purple-500" },
  "默认": { border: "border-gray-200 dark:border-gray-800", bg: "bg-gray-50/40 dark:bg-gray-900/10", text: "text-gray-900 dark:text-gray-200", bar: "bg-gray-500" },
};

function CollapsibleSection({
  label,
  content,
  isOpen,
  onToggle,
  icon: Icon
}: {
  label: string;
  content: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ElementType;
}) {
  const theme = COLOR_THEMES[label] ?? COLOR_THEMES["默认"];
  return (
    <div className={`rounded-lg border ${theme.border} ${theme.bg} overflow-hidden transition-all duration-200`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="w-full justify-start"
      >
        <span className={`w-1 h-3.5 rounded-full ${theme.bar}`} />
        <Icon className={`h-4 w-4 ${theme.text}`} />
        <span className={`text-xs font-semibold tracking-wide ${theme.text}`}>{label}</span>
        {isOpen ? (
          <ChevronUp className={`h-4 w-4 ${theme.text} ml-auto`} />
        ) : (
          <ChevronDown className={`h-4 w-4 ${theme.text} ml-auto`} />
        )}
      </Button>
      {isOpen && (
        <div className="px-3 pb-3 pt-0 pl-10 border-t border-border/40">
          {renderContent(content)}
        </div>
      )}
    </div>
  );
}

export function ReviewCard({
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
  onMarkReviewed,
}: ReviewCardProps) {
  const config = CARD_TYPE_CONFIG[cardType] ?? CARD_TYPE_CONFIG.golden_sentence;
  const TypeIcon = config.icon;

  const [revealedSections, setRevealedSections] = useState<Set<string>>(
    new Set(["summary"])
  );
  const [showAll, setShowAll] = useState(false);

  const toggleSection = (section: string) => {
    if (showAll) {
      setShowAll(false);
      setRevealedSections(new Set(["summary"]));
      return;
    }
    setRevealedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const revealAll = () => {
    setShowAll(true);
    setRevealedSections(
      new Set(["summary", "facts", "highlights", "transfer", "source"])
    );
  };

  const hideAll = () => {
    setShowAll(false);
    setRevealedSections(new Set(["summary"]));
  };

  const isRevealed = (section: string) => showAll || revealedSections.has(section);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {confirmed && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <h3 className="font-semibold text-sm leading-tight">{title}</h3>
            </div>
            {contentItemTitle && (
              <p className="text-xs text-muted-foreground truncate">
                来自：{contentItemTitle}
                {sourceName && ` (${sourceName})`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {confirmed && (
              <Badge variant="outline" className="text-xs">
                已复习
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-xs gap-1">
            <TypeIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* AI Summary - always visible */}
        {aiSummary && (
          <div className="flex items-start gap-2">
            <p className="text-sm">{aiSummary}</p>
          </div>
        )}

        {/* Source Snapshot */}
        {sourceSnapshot && (
          <CollapsibleSection
            label="来源快照"
            content={sourceSnapshot}
            isOpen={isRevealed("source")}
            onToggle={() => toggleSection("source")}
            icon={FileText}
          />
        )}

        {/* Original Facts */}
        {originalFacts && (
          <CollapsibleSection
            label="原始事实"
            content={originalFacts}
            isOpen={isRevealed("facts")}
            onToggle={() => toggleSection("facts")}
            icon={FileText}
          />
        )}

        {/* Highlight Suggestions */}
        {highlightSuggestions && (
          <CollapsibleSection
            label="亮点建议"
            content={highlightSuggestions}
            isOpen={isRevealed("highlights")}
            onToggle={() => toggleSection("highlights")}
            icon={BarChart3}
          />
        )}

        {/* Transfer Suggestions */}
        {transferSuggestions && (
          <CollapsibleSection
            label="迁移建议"
            content={transferSuggestions}
            isOpen={isRevealed("transfer")}
            onToggle={() => toggleSection("transfer")}
            icon={ArrowRight}
          />
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={showAll ? hideAll : revealAll}
            >
              {showAll ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  隐藏全部
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  显示全部
                </>
              )}
            </Button>
          </div>
          {onMarkReviewed && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onMarkReviewed(id)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              已掌握
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
