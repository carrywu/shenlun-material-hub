"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, Edit3, FileText, MapPin, PenTool, Target, Trash2 } from "lucide-react";
import type { MaterialCardStructuredContent } from "@/types";

interface MaterialCardProps {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  confirmed: boolean;
  articleTitle?: string;
  articleSource?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onConfirm?: (id: string) => void;
}

function parseContent(content: string): MaterialCardStructuredContent | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function MaterialCardView({
  id,
  title,
  content,
  category,
  tags,
  confirmed,
  articleTitle,
  articleSource,
  onEdit,
  onDelete,
  onConfirm,
}: MaterialCardProps) {
  const structured = parseContent(content);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
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
            {articleTitle && (
              <p className="text-xs text-muted-foreground truncate">
                来自：{articleTitle}
                {articleSource && ` (${articleSource})`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(id)}>
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
                <CheckCircle2 className={`h-3.5 w-3.5 ${confirmed ? "text-green-600" : ""}`} />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-xs">{category}</Badge>
          {tags.split(",").filter(Boolean).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>
      </CardHeader>
      {structured && (
        <CardContent className="pt-0 space-y-3">
          {/* 主旨 */}
          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{structured.mainPoint}</p>
          </div>

          {/* 结构拆解 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">结构拆解</span>
            </div>
            <div className="grid grid-cols-1 gap-1 pl-5">
              {Object.entries(structured.structure).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground">
                    {key === "background" ? "背景" :
                     key === "problem" ? "问题" :
                     key === "cause" ? "原因" :
                     key === "solution" ? "对策" : "升华"}：
                  </span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 规范表达 */}
          {structured.standardExpressions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">规范表达</span>
              </div>
              <div className="flex flex-wrap gap-1 pl-5">
                {structured.standardExpressions.map((expr, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {expr}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 省情关联 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">省情关联</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-5">
              <div className="text-xs">
                <Badge variant="outline" className="text-[10px] mr-1">粤</Badge>
                {structured.provinceRelevance.guangdong}
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="text-[10px] mr-1">湘</Badge>
                {structured.provinceRelevance.hunan}
              </div>
            </div>
          </div>
        </CardContent>
      )}
      {!structured && (
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
        </CardContent>
      )}
    </Card>
  );
}
