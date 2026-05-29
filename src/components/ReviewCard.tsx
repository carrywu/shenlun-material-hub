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
  GitCompare,
  Lightbulb,
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
  CardType,
  { label: string; icon: React.ElementType }
> = {
  fact_summary: { label: "事实摘要", icon: FileText },
  argument_analysis: { label: "论点分析", icon: BookOpen },
  data_highlight: { label: "数据亮点", icon: BarChart3 },
  policy_compare: { label: "政策对比", icon: GitCompare },
  case_study: { label: "案例研究", icon: Lightbulb },
};

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
  const config = CARD_TYPE_CONFIG[cardType] ?? CARD_TYPE_CONFIG.fact_summary;
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
          <div>
            <button
              onClick={() => toggleSection("source")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                来源快照
              </span>
              {isRevealed("source") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("source") ? (
              <p className="text-xs pl-5 mt-1 whitespace-pre-wrap">{sourceSnapshot}</p>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看来源快照...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Original Facts */}
        {originalFacts && (
          <div>
            <button
              onClick={() => toggleSection("facts")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                原始事实
              </span>
              {isRevealed("facts") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("facts") ? (
              <p className="text-xs pl-5 mt-1 whitespace-pre-wrap">{originalFacts}</p>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看原始事实...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Highlight Suggestions */}
        {highlightSuggestions && (
          <div>
            <button
              onClick={() => toggleSection("highlights")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                亮点建议
              </span>
              {isRevealed("highlights") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("highlights") ? (
              <p className="text-xs pl-5 mt-1 whitespace-pre-wrap">{highlightSuggestions}</p>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看亮点建议...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Transfer Suggestions */}
        {transferSuggestions && (
          <div>
            <button
              onClick={() => toggleSection("transfer")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                迁移建议
              </span>
              {isRevealed("transfer") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("transfer") ? (
              <p className="text-xs pl-5 mt-1 whitespace-pre-wrap">{transferSuggestions}</p>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看迁移建议...
                </span>
              </div>
            )}
          </div>
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
