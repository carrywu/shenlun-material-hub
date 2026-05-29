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
  MapPin,
  PenTool,
  Target,
} from "lucide-react";
import type { MaterialCardStructuredContent } from "@/types";

interface ReviewCardProps {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  confirmed: boolean;
  articleTitle?: string;
  articleSource?: string;
  reviewCount?: number;
  lastReviewed?: string | null;
  onMarkReviewed?: (id: string, quality: number) => void;
}

function parseContent(c: string): MaterialCardStructuredContent | null {
  try {
    return JSON.parse(c);
  } catch {
    return null;
  }
}

export function ReviewCard({
  id,
  title,
  content,
  category,
  tags,
  confirmed,
  articleTitle,
  articleSource,
  reviewCount = 0,
  lastReviewed,
  onMarkReviewed,
}: ReviewCardProps) {
  const structured = parseContent(content);
  const [revealedSections, setRevealedSections] = useState<Set<string>>(
    new Set(["mainPoint"])
  );
  const [showAll, setShowAll] = useState(false);

  const toggleSection = (section: string) => {
    if (showAll) {
      setShowAll(false);
      setRevealedSections(new Set(["mainPoint"]));
      return;
    }
    setRevealedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const revealAll = () => {
    setShowAll(true);
    setRevealedSections(
      new Set([
        "mainPoint",
        "structure",
        "expressions",
        "cases",
        "province",
        "exercise",
      ])
    );
  };

  const hideAll = () => {
    setShowAll(false);
    setRevealedSections(new Set(["mainPoint"]));
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
              <h3 className="font-semibold text-sm leading-tight">
                {title}
              </h3>
            </div>
            {articleTitle && (
              <p className="text-xs text-muted-foreground truncate">
                来自：{articleTitle}
                {articleSource && ` (${articleSource})`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {reviewCount > 0 && (
              <Badge variant="outline" className="text-xs">
                已复习 {reviewCount} 次
              </Badge>
            )}
            {lastReviewed && (
              <span className="text-xs text-muted-foreground">
                {new Date(lastReviewed).toLocaleDateString("zh-CN")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-xs">
            {category}
          </Badge>
          {tags
            .split(",")
            .filter(Boolean)
            .map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
        </div>
      </CardHeader>

      {structured && (
        <CardContent className="pt-0 space-y-3">
          {/* 主旨 - always visible */}
          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{structured.mainPoint}</p>
          </div>

          {/* 结构拆解 */}
          <div>
            <button
              onClick={() => toggleSection("structure")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                结构拆解
              </span>
              {isRevealed("structure") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("structure") ? (
              <div className="grid grid-cols-1 gap-1 pl-5 mt-1">
                {Object.entries(structured.structure).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">
                      {key === "background"
                        ? "背景"
                        : key === "problem"
                          ? "问题"
                          : key === "cause"
                            ? "原因"
                            : key === "solution"
                              ? "对策"
                              : "升华"}
                      ：
                    </span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看结构拆解...
                </span>
              </div>
            )}
          </div>

          {/* 规范表达 */}
          <div>
            <button
              onClick={() => toggleSection("expressions")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                规范表达
              </span>
              {isRevealed("expressions") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("expressions") ? (
              <div className="flex flex-wrap gap-1 pl-5 mt-1">
                {structured.standardExpressions.map((expr, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {expr}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看规范表达...
                </span>
              </div>
            )}
          </div>

          {/* 案例 */}
          {structured.cases.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection("cases")}
                className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  可用案例
                </span>
                {isRevealed("cases") ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
                )}
              </button>
              {isRevealed("cases") ? (
                <ul className="list-disc list-inside pl-5 mt-1 space-y-0.5">
                  {structured.cases.map((c, i) => (
                    <li key={i} className="text-xs">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="pl-5 mt-1">
                  <span className="text-xs text-muted-foreground italic">
                    点击展开查看案例...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 省情关联 */}
          <div>
            <button
              onClick={() => toggleSection("province")}
              className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                省情关联
              </span>
              {isRevealed("province") ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </button>
            {isRevealed("province") ? (
              <div className="grid grid-cols-2 gap-2 pl-5 mt-1">
                <div className="text-xs">
                  <Badge variant="outline" className="text-[10px] mr-1">
                    粤
                  </Badge>
                  {structured.provinceRelevance.guangdong}
                </div>
                <div className="text-xs">
                  <Badge variant="outline" className="text-[10px] mr-1">
                    湘
                  </Badge>
                  {structured.provinceRelevance.hunan}
                </div>
              </div>
            ) : (
              <div className="pl-5 mt-1">
                <span className="text-xs text-muted-foreground italic">
                  点击展开查看省情关联...
                </span>
              </div>
            )}
          </div>

          {/* 仿写练习 */}
          {structured.writingExercise && (
            <div>
              <button
                onClick={() => toggleSection("exercise")}
                className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity"
              >
                <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  仿写练习
                </span>
                {isRevealed("exercise") ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
                )}
              </button>
              {isRevealed("exercise") ? (
                <p className="text-xs pl-5 mt-1">{structured.writingExercise}</p>
              ) : (
                <div className="pl-5 mt-1">
                  <span className="text-xs text-muted-foreground italic">
                    点击展开查看仿写练习...
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
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">
                  掌握程度：
                </span>
                {[1, 2, 3, 4, 5].map((q) => (
                  <Button
                    key={q}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => onMarkReviewed(id, q)}
                    title={
                      q === 1
                        ? "完全不会"
                        : q === 2
                          ? "比较模糊"
                          : q === 3
                            ? "基本记得"
                            : q === 4
                              ? "比较熟悉"
                              : "完全掌握"
                    }
                  >
                    {q === 1
                      ? "1"
                      : q === 2
                        ? "2"
                        : q === 3
                          ? "3"
                          : q === 4
                            ? "4"
                            : "5"}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {!structured && (
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {content}
          </p>
          {onMarkReviewed && (
            <div className="flex items-center justify-end gap-1 pt-3 border-t mt-3">
              <span className="text-xs text-muted-foreground mr-1">
                掌握程度：
              </span>
              {[1, 2, 3, 4, 5].map((q) => (
                <Button
                  key={q}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => onMarkReviewed(id, q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
