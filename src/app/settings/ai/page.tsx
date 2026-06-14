"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface AiConfigData {
  configured: boolean;
  id?: string;
  name?: string;
  baseUrl?: string;
  maskedKey?: string;
  model?: string;
  temperature?: number;
  isEnabled?: boolean;
}

export default function UserAiSettingsPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();

  // Only VERIFIED_USER and ADMIN can access this page
  const isVerified = isAdmin || user?.role === "VERIFIED_USER";

  const [config, setConfig] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [temperature, setTemperature] = useState(0.3);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/ai-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setConfig(data);
          if (data.configured) {
            setBaseUrl(data.baseUrl || "https://api.deepseek.com/v1");
            setModel(data.model || "deepseek-chat");
            setTemperature(data.temperature ?? 0.3);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError("获取配置失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, model, temperature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setApiKey(""); // 清空输入的 key
      const res2 = await fetch("/api/settings/ai-config");
      if (res2.ok) {
        const data = await res2.json();
        setConfig(data);
        if (data.configured) {
          setBaseUrl(data.baseUrl || "https://api.deepseek.com/v1");
          setModel(data.model || "deepseek-chat");
          setTemperature(data.temperature ?? 0.3);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除您的个人 AI 配置吗？删除后将无法使用个人 AI 生成功能。")) return;
    try {
      const res = await fetch("/api/settings/ai-config", { method: "DELETE" });
      if (res.ok) {
        setConfig(null);
        setBaseUrl("https://api.deepseek.com/v1");
        setModel("deepseek-chat");
        setTemperature(0.3);
        setApiKey("");
        setTestResult(null);
      }
    } catch {
      setError("删除失败");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai-config/test", { method: "POST" });
      const data = await res.json();
      setTestResult({
        success: !!data.success,
        error: data.error ?? data.message,
      });
    } catch {
      setTestResult({ success: false, error: "测试请求失败" });
    } finally {
      setTesting(false);
    }
  };

  // Role guard — redirect non-verified users
  if (user && !isVerified) {
    router.push("/settings");
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canTest = !!config?.configured && config.isEnabled !== false;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">AI 配置</h1>
          <p className="text-sm text-muted-foreground mt-1">配置您的个人 AI 模型参数，优先级高于系统默认配置</p>
        </div>
      </div>

      {isAdmin && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800">
              💡 您是管理员，也可以直接{" "}
              <a href="/admin/settings/ai" className="underline font-medium">管理系统全局 AI 配置</a>。
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            模型参数
            {config?.configured && (
              <Badge variant="default" className="text-xs bg-emerald-100 text-emerald-700">已配置</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">API Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              API Key
              {config?.configured && <span className="text-muted-foreground ml-1">(当前: {config.maskedKey})</span>}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.configured ? "留空则保持不变" : "输入 API Key"}
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">模型名称</label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>精确 (0)</span>
              <span>创意 (1)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || (!config?.configured && !apiKey)} size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              保存配置
            </Button>
            <Button onClick={handleTest} disabled={testing || !canTest} variant="outline" size="sm">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : "测试连接"}
            </Button>
            {config?.configured && (
              <Button onClick={handleDelete} variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                删除
              </Button>
            )}
          </div>

          {!canTest && (
            <p className="text-xs text-muted-foreground">
              请先保存并启用您的个人 AI 配置后再测试连接。
            </p>
          )}

          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.success ? "text-emerald-700" : "text-red-700"}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.success ? "连接成功" : `连接失败: ${testResult.error}`}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">优先级说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>1. <strong>个人配置</strong>（本页面）— 最高优先级</p>
          <p>2. <strong>系统全局配置</strong> — 管理员设置</p>
          <p>3. <strong>环境变量</strong> — 服务器配置兜底</p>
        </CardContent>
      </Card>
    </div>
  );
}
