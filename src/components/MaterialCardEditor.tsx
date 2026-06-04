"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";
import type { CardType } from "@/types";

interface MaterialCardEditorProps {
  initialData: {
    title: string;
    cardType: CardType;
    sourceSnapshot: string | null;
    originalFacts: string | null;
    aiSummary: string | null;
    highlightSuggestions: string | null;
    transferSuggestions: string | null;
    verificationNotes: string | null;
    userEditedContent: string | null;
  };
  onSave: (data: {
    title: string;
    cardType: CardType;
    sourceSnapshot: string;
    originalFacts: string;
    aiSummary: string;
    highlightSuggestions: string;
    transferSuggestions: string;
    verificationNotes: string;
    userEditedContent: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const CARD_TYPE_OPTIONS: { value: CardType; label: string }[] = [
  { value: "golden_sentence", label: "申论金句" },
  { value: "standard_expression", label: "规范词" },
  { value: "case_material", label: "案例素材" },
  { value: "countermeasure", label: "对策表达" },
  { value: "problem_statement", label: "问题表述" },
  { value: "reason_analysis", label: "原因分析" },
  { value: "policy_expression", label: "政策表述" },
  { value: "person_story", label: "人物事迹" },
  { value: "article_structure", label: "文章框架" },
];

export function MaterialCardEditor({
  initialData,
  onSave,
  onCancel,
}: MaterialCardEditorProps) {
  const [title, setTitle] = useState(initialData.title);
  const [cardType, setCardType] = useState<CardType>(initialData.cardType as CardType);
  const [sourceSnapshot, setSourceSnapshot] = useState(initialData.sourceSnapshot ?? "");
  const [originalFacts, setOriginalFacts] = useState(initialData.originalFacts ?? "");
  const [aiSummary, setAiSummary] = useState(initialData.aiSummary ?? "");
  const [highlightSuggestions, setHighlightSuggestions] = useState(
    initialData.highlightSuggestions ?? ""
  );
  const [transferSuggestions, setTransferSuggestions] = useState(
    initialData.transferSuggestions ?? ""
  );
  const [verificationNotes, setVerificationNotes] = useState(
    initialData.verificationNotes ?? ""
  );
  const [userEditedContent, setUserEditedContent] = useState(
    initialData.userEditedContent ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        title,
        cardType,
        sourceSnapshot,
        originalFacts,
        aiSummary,
        highlightSuggestions,
        transferSuggestions,
        verificationNotes,
        userEditedContent,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="ai-content" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai-content">AI 内容</TabsTrigger>
          <TabsTrigger value="suggestions">建议</TabsTrigger>
          <TabsTrigger value="notes">备注</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-content" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">标题</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">卡片类型</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {CARD_TYPE_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant={cardType === opt.value ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setCardType(opt.value)}
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">来源快照</label>
            <textarea
              value={sourceSnapshot}
              onChange={(e) => setSourceSnapshot(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">原始事实</label>
            <textarea
              value={originalFacts}
              onChange={(e) => setOriginalFacts(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">AI 摘要</label>
            <textarea
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            />
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-3 mt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">亮点建议</label>
            <textarea
              value={highlightSuggestions}
              onChange={(e) => setHighlightSuggestions(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">迁移建议</label>
            <textarea
              value={transferSuggestions}
              onChange={(e) => setTransferSuggestions(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
            />
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-3 mt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">验证备注</label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
              placeholder="添加验证备注..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">用户编辑内容</label>
            <textarea
              value={userEditedContent}
              onChange={(e) => setUserEditedContent(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
              placeholder="自定义编辑内容..."
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
