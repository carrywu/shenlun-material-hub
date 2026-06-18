"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, TestTube, Trash2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingIndicator } from "@/components/ui/loading-skeleton";

interface AiConfigData {
  configured: boolean;
  id?: string;
  baseUrl?: string;
  maskedKey?: string;
  model?: string;
  temperature?: number;
  isEnabled?: boolean;
  lastTestedAt?: string;
  lastTestError?: string;
}

interface PromptTemplate {
  key: string;
  name: string;
  description: string;
  content: string;
  defaultContent: string;
  customized: boolean;
}

export default function AiConfigPage() {
  const [config, setConfig] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [promptSavingKey, setPromptSavingKey] = useState<string | null>(null);

  // 表单状态
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [temperature, setTemperature] = useState(0.3);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchPromptTemplates();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/ai-config");
      const data = await res.json();
      setConfig(data);
      if (data.configured) {
        setBaseUrl(data.baseUrl || "https://api.deepseek.com/v1");
        setModel(data.model || "deepseek-v4-flash");
        setTemperature(data.temperature ?? 0.3);
      }
    } catch (err) {
      console.error("加载配置失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPromptTemplates() {
    try {
      const res = await fetch("/api/ai-config/prompts");
      const data = await res.json();
      const templates = Array.isArray(data.templates) ? data.templates : [];
      setPromptTemplates(templates);
      setPromptDrafts(Object.fromEntries(templates.map((template: PromptTemplate) => [template.key, template.content])));
    } catch (err) {
      console.error("加载提示词配置失败:", err);
      toast.error("加载提示词配置失败");
    }
  }

  async function handleSave() {
    if (!apiKey && !config?.configured) {
      toast.warning("请输入 API Key");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiKey: apiKey || undefined,
          model,
          temperature,
        }),
      });

      if (res.ok) {
        setApiKey("");
        await fetchConfig();
        toast.success("配置已保存");
      } else {
        const data = await res.json();
        toast.error("保存失败", { description: data.error });
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai-config/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      await fetchConfig(); // 刷新 lastTestedAt
    } catch {
      setTestResult({ success: false, error: "请求失败" });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定删除 AI 配置？")) return;
    try {
      await fetch("/api/ai-config", { method: "DELETE" });
      setConfig(null);
      setApiKey("");
      setBaseUrl("https://api.deepseek.com/v1");
      setModel("deepseek-v4-flash");
      setTemperature(0.3);
      toast.success("AI 配置已删除");
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleSavePrompt(key: string) {
    const content = promptDrafts[key]?.trim() ?? "";
    if (!content) {
      toast.warning("提示词内容不能为空");
      return;
    }

    setPromptSavingKey(key);
    try {
      const res = await fetch("/api/ai-config/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存提示词失败");
      }
      await fetchPromptTemplates();
      toast.success("提示词已保存");
    } catch (err) {
      toast.error("保存提示词失败", { description: err instanceof Error ? err.message : "请稍后重试" });
    } finally {
      setPromptSavingKey(null);
    }
  }

  async function handleRestorePrompt(key: string) {
    setPromptSavingKey(key);
    try {
      const res = await fetch("/api/ai-config/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "恢复默认失败");
      }
      await fetchPromptTemplates();
      toast.success("已恢复默认提示词");
    } catch (err) {
      toast.error("恢复默认失败", { description: err instanceof Error ? err.message : "请稍后重试" });
    } finally {
      setPromptSavingKey(null);
    }
  }

  if (loading) {
    return <LoadingIndicator className="h-full" />
  }

  return (
    <div data-testid="ai-config-page" className="flex flex-col h-full">
      {/* Header — AdminShell already renders the document <h1> ("AI 配置"),
          so this block only provides a back-link + subtitle. */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="text-sm text-muted-foreground">
            配置 AI 服务连接，用于内容评估和素材卡生成
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 状态卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              连接状态
              {config?.configured ? (
                <Badge variant="default">已配置</Badge>
              ) : (
                <Badge variant="secondary">未配置</Badge>
              )}
            </CardTitle>
            {config?.lastTestedAt && (
              <CardDescription>
                上次测试: {new Date(config.lastTestedAt).toLocaleString("zh-CN")}
                {config.lastTestError && (
                  <span className="text-destructive ml-2">— {config.lastTestError}</span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !config?.configured}
              >
                <TestTube className="mr-1.5 h-4 w-4" />
                {testing ? "测试中..." : "测试连接"}
              </Button>
              {testResult && (
                <Badge variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success ? "连接成功" : `失败: ${testResult.error}`}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 配置表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">服务配置</CardTitle>
            <CardDescription>
              支持 OpenAI 兼容 API（OpenAI、Deepseek、通义千问等）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">API Base URL</label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="mt-1"
                placeholder="https://api.deepseek.com/v1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deepseek: https://api.deepseek.com/v1 | OpenAI: https://api.openai.com/v1
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">API Key</label>
              <div className="relative mt-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                  placeholder={config?.configured ? `当前: ${config.maskedKey}` : "sk-..."}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Key 会加密存储在数据库中。留空则保持现有 Key 不变。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">模型</label>
                <Input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1"
                  placeholder="deepseek-v4-flash"
                />
              </div>
              <div>
                <label className="text-sm font-medium">温度 (0-1)</label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "保存中..." : "保存配置"}
              </Button>
              {config?.configured && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  删除配置
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI 默认提示词模板</CardTitle>
            <CardDescription>
              管理文章评估和素材卡生成的默认提示词。自定义内容会优先生效；留空不会保存，运行异常时自动回退默认提示词。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-2">可用变量</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <span><code>{"{{title}}"}</code>：文章标题</span>
                <span><code>{"{{sourceName}}"}</code>：来源名称</span>
                <span><code>{"{{contentType}}"}</code>：内容类型</span>
                <span><code>{"{{content}}"}</code>：文章正文</span>
                <span><code>{"{{excerpt}}"}</code>：文章摘要</span>
                <span><code>{"{{aiSummary}}"}</code>：已有 AI 摘要</span>
                <span><code>{"{{aiCategories}}"}</code>：已有 AI 分类</span>
                <span><code>{"{{aiQuotes}}"}</code>：已有 AI 金句</span>
              </div>
            </div>

            {promptTemplates.length === 0 ? (
              <EmptyState title="暂无提示词模板" description="系统将自动生成默认模板" />
            ) : (
              <div className="space-y-4">
                {promptTemplates.map((template) => (
                  <div
                    key={template.key}
                    data-testid={`prompt-template-${template.key}`}
                    className="rounded-md border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{template.name}</p>
                          {template.customized ? (
                            <Badge variant="default" className="text-[10px]">已自定义</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">默认</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestorePrompt(template.key)}
                          disabled={promptSavingKey === template.key}
                        >
                          恢复默认
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSavePrompt(template.key)}
                          disabled={promptSavingKey === template.key}
                        >
                          {promptSavingKey === template.key ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      aria-label={`${template.name}内容`}
                      value={promptDrafts[template.key] ?? ""}
                      onChange={(event) => setPromptDrafts((prev) => ({
                        ...prev,
                        [template.key]: event.target.value,
                      }))}
                      rows={8}
                      className="font-mono text-xs leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. 配置 AI 服务后，系统会自动使用 AI 评估采集内容的相关性</p>
            <p>2. 普通新闻、会议新闻、通知公告会被自动过滤</p>
            <p>3. 只有评论、政策解读、案例实践类内容才会进入候选池</p>
            <p>4. 素材卡生成需要已通过 AI 评估的内容</p>
            <p>
              5. 需要设置环境变量 <code>AI_CONFIG_ENCRYPTION_KEY</code> 用于加密存储 API Key
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
