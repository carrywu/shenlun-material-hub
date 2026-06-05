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
  FileText,
  BookOpen,
  BarChart3,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { CardType } from "@/types";
import { CONTENT_TYPE_LABELS, PLATFORM_LABELS } from "@/lib/display-labels";
import { useAuth } from "@/lib/auth-context";

interface CardDetail {
  id: string;
  title: string;
  cardType: CardType;
  sourceSnapshot: string | null;
  originalFacts: string | null;
  aiSummary: string | null;
  highlightSuggestions: string | null;
  transferSuggestions: string | null;
  verificationNotes: string | null;
  markdownContent: string | null;
  userEditedContent: string | null;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
  contentItem: {
    id: string;
    title: string;
    originalUrl: string;
    contentType: string;
    platform: string;
    fullText: string | null;
    source: { id: string; name: string; platform: string } | null;
  };
  syncRecords: Array<{
    id: string;
    status: string;
    syncedAt: string;
    errorMessage: string | null;
  }>;
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

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;
  const { isAdmin } = useAuth();

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCard();
  }, [fetchCard]);

  async function handleSave(data: {
    title: string;
    cardType: CardType;
    sourceSnapshot: string;
    originalFacts: string;
    aiSummary: string;
    highlightSuggestions: string;
    transferSuggestions: string;
    verificationNotes: string;
    userEditedContent: string;
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

  const config = CARD_TYPE_CONFIG[card.cardType] ?? CARD_TYPE_CONFIG.golden_sentence;
  const TypeIcon = config.icon;

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
                <Badge variant="secondary" className="text-xs gap-1">
                  <TypeIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
                {card.confirmed && (
                  <Badge variant="default" className="text-xs bg-green-600">
                    已确认
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                来自：{card.contentItem.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
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
                  confirmed={card.confirmed}
                  onSyncComplete={fetchCard}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={handleDelete}
                >
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
              cardType: card.cardType,
              sourceSnapshot: card.sourceSnapshot,
              originalFacts: card.originalFacts,
              aiSummary: card.aiSummary,
              highlightSuggestions: card.highlightSuggestions,
              transferSuggestions: card.transferSuggestions,
              verificationNotes: card.verificationNotes,
              userEditedContent: card.userEditedContent,
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
                cardType={card.cardType}
                confirmed={card.confirmed}
                sourceSnapshot={card.sourceSnapshot}
                originalFacts={card.originalFacts}
                aiSummary={card.aiSummary}
                highlightSuggestions={card.highlightSuggestions}
                transferSuggestions={card.transferSuggestions}
              />

              {/* User edited content */}
              {card.userEditedContent && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">用户编辑内容</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {card.userEditedContent}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Verification notes */}
              {card.verificationNotes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">验证备注</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {card.verificationNotes}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Content item info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">原文信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">{card.contentItem.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {card.contentItem.source && (
                      <Badge variant="outline" className="text-xs">
                        {card.contentItem.source.name}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {CONTENT_TYPE_LABELS[card.contentItem.contentType] ?? card.contentItem.contentType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {PLATFORM_LABELS[card.contentItem.platform] ?? card.contentItem.platform}
                    </Badge>
                  </div>
                  <a
                    href={card.contentItem.originalUrl}
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
                              variant={
                                record.status === "success"
                                  ? "default"
                                  : record.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {record.status === "success"
                                ? "成功"
                                : record.status === "failed"
                                  ? "失败"
                                  : "待同步"}
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
                  <p>
                    创建时间：
                    {new Date(card.createdAt).toLocaleString("zh-CN")}
                  </p>
                  <p>
                    更新时间：
                    {new Date(card.updatedAt).toLocaleString("zh-CN")}
                  </p>
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
