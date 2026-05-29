"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ExternalLink, Pencil, X } from "lucide-react";

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
    source?: { name: string } | null;
    _count?: { materialCards: number };
  };
  onClose: () => void;
}

export function ArticleDetail({ article, onClose }: ContentItemDetailProps) {
  const tags = article.topicTags
    ? (() => { try { return JSON.parse(article.topicTags); } catch { return []; } })()
    : [];

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
        {article.excerpt && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium mb-1">摘要</p>
            <p className="text-sm text-muted-foreground">{article.excerpt}</p>
          </div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {article.fullText ?? "暂无全文内容"}
        </div>
      </CardContent>
    </Card>
  );
}
