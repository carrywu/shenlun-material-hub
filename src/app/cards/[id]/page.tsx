"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaterialCardView } from "@/components/MaterialCard";
import { MaterialCardEditor } from "@/components/MaterialCardEditor";
import { SyncToIma } from "@/components/SyncToIma";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Trash2,
} from "lucide-react";

interface CardDetail {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  excerpt: string | null;
  notes: string | null;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
  article: {
    id: string;
    title: string;
    source: string;
    url: string;
    category: string;
  };
  syncRecords: Array<{
    id: string;
    status: string;
    syncedAt: string;
    errorMessage: string | null;
  }>;
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;

  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const fetchCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/material-cards/${cardId}`);
      if (!res.ok) throw new Error("请求失败");
      const data = await res.json();
      setCard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  async function handleSave(data: {
    title: string;
    content: string;
    category: string;
    tags: string;
    excerpt: string;
    notes: string;
  }) {
    const res = await fetch(`/api/material-cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("保存失败");
    setEditing(false);
    fetchCard();
  }

  async function handleToggleConfirm() {
    if (!card) return;
    const res = await fetch(`/api/material-cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: !card.confirmed }),
    });
    if (!res.ok) throw new Error("操作失败");
    fetchCard();
  }

  async function handleDelete() {
    if (!confirm("确定删除此素材卡？")) return;
    const res = await fetch(`/api/material-cards/${cardId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("删除失败");
    router.push("/cards");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">{error ?? "素材卡不存在"}</p>
        <Button variant="outline" onClick={() => router.push("/cards")}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/cards")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">素材卡详情</h1>
                {card.confirmed && (
                  <Badge variant="default" className="text-xs bg-green-600">已确认</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                来自：{card.article.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit3 className="mr-1.5 h-4 w-4" />
                  编辑
                </Button>
                <Button
                  variant={card.confirmed ? "outline" : "default"}
                  size="sm"
                  onClick={handleToggleConfirm}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {card.confirmed ? "取消确认" : "确认"}
                </Button>
                <SyncToIma
                  cardId={cardId}
                  cardTitle={card.title}
                  onSyncComplete={fetchCard}
                />
                <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {editing ? (
          <MaterialCardEditor
            initialData={{
              title: card.title,
              content: card.content,
              category: card.category,
              tags: card.tags,
              excerpt: card.excerpt,
              notes: card.notes,
            }}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-4">
              <MaterialCardView
                id={card.id}
                title={card.title}
                content={card.content}
                category={card.category}
                tags={card.tags}
                confirmed={card.confirmed}
              />

              {/* User notes */}
              {card.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">用户笔记</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{card.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Article info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">原文信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">{card.article.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{card.article.source}</Badge>
                    <Badge variant="secondary" className="text-xs">{card.article.category}</Badge>
                  </div>
                  <a
                    href={card.article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    查看原文
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>

              {/* Sync records */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>同步记录</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {card.syncRecords.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {card.syncRecords.length === 0 ? (
                    <p className="text-xs text-muted-foreground">暂无同步记录</p>
                  ) : (
                    <div className="space-y-2">
                      {card.syncRecords.map((record) => (
                        <div key={record.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <Badge
                              variant={record.status === "success" ? "default" : record.status === "failed" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {record.status === "success" ? "成功" : record.status === "failed" ? "失败" : "待同步"}
                            </Badge>
                            <span className="text-muted-foreground">
                              {new Date(record.syncedAt).toLocaleString("zh-CN")}
                            </span>
                          </div>
                          {record.errorMessage && (
                            <p className="text-[10px] text-destructive truncate">
                              {record.errorMessage}
                            </p>
                          )}
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
                  <p>创建时间：{new Date(card.createdAt).toLocaleString("zh-CN")}</p>
                  <p>更新时间：{new Date(card.updatedAt).toLocaleString("zh-CN")}</p>
                  <p>ID：{card.id}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
