"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Save, X } from "lucide-react";
import type { MaterialCardStructuredContent } from "@/types";

interface MaterialCardEditorProps {
  initialData: {
    title: string;
    content: string;
    category: string;
    tags: string;
    excerpt: string | null;
    notes: string | null;
  };
  onSave: (data: {
    title: string;
    content: string;
    category: string;
    tags: string;
    excerpt: string;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}

function parseContent(content: string): MaterialCardStructuredContent {
  try {
    return JSON.parse(content);
  } catch {
    return {
      mainPoint: "",
      structure: { background: "", problem: "", cause: "", solution: "", sublimation: "" },
      standardExpressions: [],
      cases: [],
      provinceRelevance: { guangdong: "", hunan: "" },
      applicableTypes: [],
      writingExercise: "",
    };
  }
}

export function MaterialCardEditor({ initialData, onSave, onCancel }: MaterialCardEditorProps) {
  const [title, setTitle] = useState(initialData.title);
  const [category, setCategory] = useState(initialData.category);
  const [tags, setTags] = useState(initialData.tags);
  const [excerpt, setExcerpt] = useState(initialData.excerpt ?? "");
  const [notes, setNotes] = useState(initialData.notes ?? "");
  const [structured, setStructured] = useState<MaterialCardStructuredContent>(
    parseContent(initialData.content)
  );
  const [newExpression, setNewExpression] = useState("");
  const [newCase, setNewCase] = useState("");
  const [saving, setSaving] = useState(false);

  function updateStructure(field: keyof MaterialCardStructuredContent, value: unknown) {
    setStructured((prev) => ({ ...prev, [field]: value }));
  }

  function updateNestedStructure(field: keyof MaterialCardStructuredContent["structure"], value: string) {
    setStructured((prev) => ({
      ...prev,
      structure: { ...prev.structure, [field]: value },
    }));
  }

  function updateProvince(province: "guangdong" | "hunan", value: string) {
    setStructured((prev) => ({
      ...prev,
      provinceRelevance: { ...prev.provinceRelevance, [province]: value },
    }));
  }

  function addExpression() {
    if (newExpression.trim()) {
      setStructured((prev) => ({
        ...prev,
        standardExpressions: [...prev.standardExpressions, newExpression.trim()],
      }));
      setNewExpression("");
    }
  }

  function removeExpression(index: number) {
    setStructured((prev) => ({
      ...prev,
      standardExpressions: prev.standardExpressions.filter((_, i) => i !== index),
    }));
  }

  function addCase() {
    if (newCase.trim()) {
      setStructured((prev) => ({
        ...prev,
        cases: [...prev.cases, newCase.trim()],
      }));
      setNewCase("");
    }
  }

  function removeCase(index: number) {
    setStructured((prev) => ({
      ...prev,
      cases: prev.cases.filter((_, i) => i !== index),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        title,
        content: JSON.stringify(structured),
        category,
        tags,
        excerpt,
        notes,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="structure">结构拆解</TabsTrigger>
          <TabsTrigger value="expressions">表达与案例</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-3 mt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">标题（主旨）</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">分类</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">标签（逗号分隔）</label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">原文摘录</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">用户笔记</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            />
          </div>
        </TabsContent>

        <TabsContent value="structure" className="space-y-3 mt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">一句话主旨</label>
            <Input
              value={structured.mainPoint}
              onChange={(e) => updateStructure("mainPoint", e.target.value)}
              className="mt-1"
            />
          </div>
          {(["background", "problem", "cause", "solution", "sublimation"] as const).map((key) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground">
                {key === "background" ? "背景" :
                 key === "problem" ? "问题" :
                 key === "cause" ? "原因" :
                 key === "solution" ? "对策" : "升华"}
              </label>
              <textarea
                value={structured.structure[key]}
                onChange={(e) => updateNestedStructure(key, e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-muted-foreground">仿写练习提示</label>
            <textarea
              value={structured.writingExercise}
              onChange={(e) => updateStructure("writingExercise", e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            />
          </div>
        </TabsContent>

        <TabsContent value="expressions" className="space-y-4 mt-3">
          {/* 规范表达 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">规范表达</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {structured.standardExpressions.map((expr, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1">
                    {expr}
                    <button onClick={() => removeExpression(i)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newExpression}
                  onChange={(e) => setNewExpression(e.target.value)}
                  placeholder="添加规范表达..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addExpression()}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={addExpression}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 案例 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">可用案例</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {structured.cases.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1">{c}</span>
                  <button onClick={() => removeCase(i)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newCase}
                  onChange={(e) => setNewCase(e.target.value)}
                  placeholder="添加案例..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addCase()}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={addCase}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 省情关联 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">省情关联</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">广东省</label>
                <textarea
                  value={structured.provinceRelevance.guangdong}
                  onChange={(e) => updateProvince("guangdong", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">湖南省</label>
                <textarea
                  value={structured.provinceRelevance.hunan}
                  onChange={(e) => updateProvince("hunan", e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
