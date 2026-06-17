"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  RefreshCw,
  Loader2,
  BookOpen,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { ReviewCard } from "@/components/ReviewCard";
import type { CardType } from "@/types";
import { useAuth } from "@/lib/auth-context";

interface ReviewCardData {
  id: string;
  title: string;
  cardType: CardType;
  confirmed: boolean;
  sourceSnapshot: string | null;
  originalFacts: string | null;
  aiSummary: string | null;
  highlightSuggestions: string | null;
  transferSuggestions: string | null;
  createdAt: string;
  contentItem?: {
    id: string;
    title: string;
    source: { name: string } | null;
  };
}

const CARD_TYPES = [
  "golden_sentence",
  "standard_expression",
  "case_material",
  "countermeasure",
  "problem_statement",
  "reason_analysis",
  "policy_expression",
  "person_story",
  "article_structure",
];

const CARD_TYPE_LABELS: Record<string, string> = {
  golden_sentence: "申论金句",
  standard_expression: "规范词",
  case_material: "案例素材",
  countermeasure: "对策表达",
  problem_statement: "问题表述",
  reason_analysis: "原因分析",
  policy_expression: "政策表述",
  data_fact: "案例素材",
  person_story: "人物事迹",
  article_structure: "文章框架",
  // Legacy fallback
  fact_summary: "案例素材",
  argument_analysis: "原因分析",
  data_highlight: "案例素材",
  policy_compare: "政策表述",
  case_study: "案例素材",
};

export default function ReviewPage() {
  const { isAdmin, user } = useAuth();
  const [cards, setCards] = useState<ReviewCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("random");
  const [cardType, setCardType] = useState("");
  const [reviewedInSession, setReviewedInSession] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  // P1-2: 复习类型——card（素材卡）/ article（收藏文章）。USER 默认 article。
  const [reviewType, setReviewType] = useState<"card" | "article">("card");

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "10");
      // P1-2: 文章复习走 type=article 分支
      if (reviewType === "article") {
        params.set("type", "article");
      } else {
        params.set("mode", mode);
        if (cardType) params.set("category", cardType);
      }

      const res = await fetch(`/api/review?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setCards(data.data ?? []);
      } else {
        setCards([]);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, cardType, reviewType]);

  const fetchStats = useCallback(async () => {
    try {
      const totalRes = await fetch("/api/material-cards?pageSize=1");
      const totalData = await totalRes.json();
      if (totalRes.ok) setTotalCards(totalData.total ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCards();
    fetchStats();
  }, [fetchCards, fetchStats]);

  const handleMarkReviewed = async (cardId: string) => {
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });

      if (res.ok) {
        setReviewedInSession((prev) => prev + 1);
        setCards((prev) => prev.filter((c) => c.id !== cardId));

        if (cards.length <= 1) {
          fetchCards();
        }
      }
    } catch {
      // ignore
    }
  };

  const handleRefresh = () => {
    fetchCards();
  };

  const modeLabels: Record<string, string> = {
    random: "随机复习",
    unreviewed: "未复习优先",
    weak: "薄弱环节",
  };
  const canGenerateCards = isAdmin || user?.role === "VERIFIED_USER";
  const emptyStateTitle = canGenerateCards ? "还没有可复习的素材卡" : "还没有复习数据";
  const emptyStateDescription = canGenerateCards
    ? "先从已审核文章生成自己的素材卡，再回到这里复习巩固。"
    : "升级认证后即可基于已审核文章生成自己的素材卡并开始复习。";
  const emptyStateHref = canGenerateCards ? "/articles" : "/settings/account";
  const emptyStateActionLabel = canGenerateCards ? "去文章页生成素材卡" : "去账号设置升级";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <PageHeader
          title="复习模式"
          description="逐步揭示素材卡内容，检验记忆效果"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              换一批
            </Button>
          }
        />
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-4 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold">{cards.length}</p>
                <p className="text-xs text-muted-foreground">当前待复习</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold">{reviewedInSession}</p>
                <p className="text-xs text-muted-foreground">本次已复习</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-4 pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold">{totalCards}</p>
                <p className="text-xs text-muted-foreground">素材卡总数</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* P1-2: 复习类型 Tab（按角色：USER 仅收藏文章；VERIFIED_USER/ADMIN 两者皆有） */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setReviewType("card")}
            disabled={user?.role === "USER"}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              reviewType === "card"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            } ${user?.role === "USER" ? "cursor-not-allowed opacity-40" : ""}`}
          >
            素材卡复习
          </button>
          <button
            type="button"
            onClick={() => setReviewType("article")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              reviewType === "article"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            收藏文章复习
          </button>
        </div>

        {/* Controls（仅素材卡模式） */}
        {reviewType === "card" && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={mode} onValueChange={(v) => { if (v) setMode(v); }}>
            <SelectTrigger className="w-36" aria-label="复习模式">
              <SelectValue>
                {modeLabels[mode] ?? mode}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">随机复习</SelectItem>
              <SelectItem value="unreviewed">未复习优先</SelectItem>
              <SelectItem value="weak">薄弱环节</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={cardType}
            onValueChange={(v) => setCardType(v === "all" || !v ? "" : v)}
          >
            <SelectTrigger className="w-32" aria-label="素材卡类型">
              <SelectValue>
                {cardType === "" ? "全部类型" : (CARD_TYPE_LABELS[cardType] ?? cardType)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {CARD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CARD_TYPE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="outline" className="text-xs">
            {modeLabels[mode]}
          </Badge>
        </div>
        )}

        {/* P1-2: 收藏文章复习列表 */}
        {reviewType === "article" && !loading && cards.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-green-500 opacity-50" />
              <p className="text-lg font-medium">暂无收藏文章可复习</p>
              <p className="text-sm">去文章列表收藏几篇文章吧</p>
              <Link href="/articles" className="mt-4">
                <Button variant="default" size="sm">浏览文章</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {reviewType === "article" && !loading && cards.length > 0 && (
          <div className="space-y-3">
            {cards.map((art: { id: string; title?: string; excerpt?: string | null }) => (
              <Card key={art.id}>
                <CardContent className="pt-4 pb-4">
                  <Link href={`/articles/${art.id}`} className="block">
                    <p className="font-medium hover:text-primary">{art.title ?? "无标题"}</p>
                    {art.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{art.excerpt}</p>
                    )}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Review cards（仅素材卡模式） */}
        {reviewType === "card" && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-green-500 opacity-50" />
              <p className="text-lg font-medium">{emptyStateTitle}</p>
              <p className="text-sm">{emptyStateDescription}</p>
              <div className="flex items-center gap-3 mt-4">
                <Link href={emptyStateHref}>
                  <Button variant="default" size="sm">
                    {emptyStateActionLabel}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <ReviewCard
                key={card.id}
                id={card.id}
                title={card.title}
                cardType={card.cardType}
                confirmed={card.confirmed}
                sourceSnapshot={card.sourceSnapshot}
                originalFacts={card.originalFacts}
                aiSummary={card.aiSummary}
                highlightSuggestions={card.highlightSuggestions}
                transferSuggestions={card.transferSuggestions}
                contentItemTitle={card.contentItem?.title}
                sourceName={card.contentItem?.source?.name}
                onMarkReviewed={handleMarkReviewed}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
