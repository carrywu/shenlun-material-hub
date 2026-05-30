"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, TestTube, Trash2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

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

export default function AiConfigPage() {
  const [config, setConfig] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // 表单状态
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.3);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/ai-config");
      const data = await res.json();
      setConfig(data);
      if (data.configured) {
        setBaseUrl(data.baseUrl || "https://api.openai.com/v1");
        setModel(data.model || "gpt-4o");
        setTemperature(data.temperature ?? 0.3);
      }
    } catch (err) {
      console.error("加载配置失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!apiKey && !config?.configured) {
      alert("请输入 API Key");
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
        alert("配置已保存");
      } else {
        const data = await res.json();
        alert(`保存失败: ${data.error}`);
      }
    } catch (err) {
      alert("保存失败");
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
    } catch (err) {
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
      setBaseUrl("https://api.openai.com/v1");
      setModel("gpt-4o");
      setTemperature(0.3);
    } catch {
      alert("删除失败");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">AI 配置</h1>
            <p className="text-sm text-muted-foreground">
              配置 AI 服务连接，用于内容评估和素材卡生成
            </p>
          </div>
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
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                OpenAI: https://api.openai.com/v1 | Deepseek: https://api.deepseek.com/v1
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">API Key</label>
              <div className="relative mt-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border rounded-md text-sm"
                  placeholder={config?.configured ? `当前: ${config.maskedKey}` : "sk-..."}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Key 会加密存储在数据库中。留空则保持现有 Key 不变。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">模型</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  placeholder="gpt-4o"
                />
              </div>
              <div>
                <label className="text-sm font-medium">温度 (0-1)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
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
