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
import {
  RefreshCw,
  Loader2,
  BookOpen,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { ReviewCard } from "@/components/ReviewCard";
import type { CardType } from "@/types";

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
  const [cards, setCards] = useState<ReviewCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("random");
  const [cardType, setCardType] = useState("");
  const [reviewedInSession, setReviewedInSession] = useState(0);
  const [totalCards, setTotalCards] = useState(0);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("limit", "10");
      if (cardType) params.set("category", cardType);

      const res = await fetch(`/api/review?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setCards(data.data);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, cardType]);

  const fetchStats = useCallback(async () => {
    try {
      const totalRes = await fetch("/api/material-cards?pageSize=1");
      const totalData = await totalRes.json();
      if (totalRes.ok) setTotalCards(totalData.total);
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">复习模式</h1>
            <p className="text-sm text-muted-foreground">
              逐步揭示素材卡内容，检验记忆效果
            </p>
          </div>
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
        </div>
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

        {/* Controls */}
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

        {/* Review cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-green-500 opacity-50" />
              <p className="text-lg font-medium">太棒了！</p>
              <p className="text-sm">当前没有需要复习的素材卡</p>
              <div className="flex items-center gap-3 mt-4">
                <Link href="/cards">
                  <Button variant="default" size="sm">
                    查看素材卡
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
        )}
      </div>
    </div>
  );
}
