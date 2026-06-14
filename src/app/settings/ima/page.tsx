"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface ImaTarget {
  id: string;
  name: string;
  baseUrl: string;
  clientId: string;
  maskedKey: string;
  knowledgeBaseId: string;
  isEnabled: boolean;
  createdAt: string;
}

interface ImaHealth {
  configured: boolean;
  reachable: boolean;
  authValid: boolean;
  workspace?: string;
  lastCheckedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export default function ImaSettingsPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const isVerified = isAdmin || user?.role === "VERIFIED_USER";

  const [targets, setTargets] = useState<ImaTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<ImaHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/ima-targets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setTargets(data.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("获取 IMA 目标列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const resetForm = () => {
    setName("");
    setBaseUrl("");
    setClientId("");
    setApiKey("");
    setKnowledgeBaseId("");
    setShowForm(false);
    setError("");
  };

  // Role guard — redirect non-verified users
  if (user && !isVerified) {
    router.push("/settings");
    return null;
  }

  const handleCreate = async () => {
    // Non-admin only needs clientId and apiKey; admin needs all fields
    if (isAdmin) {
      if (!name || !baseUrl || !clientId || !apiKey || !knowledgeBaseId) {
        setError("请填写所有字段");
        return;
      }
    } else {
      if (!clientId || !apiKey) {
        setError("请填写 Client ID 和 API Key");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/ima-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baseUrl, clientId, apiKey, knowledgeBaseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      resetForm();
      // Re-fetch targets after create
      const refreshRes = await fetch("/api/settings/ima-targets");
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setTargets(refreshData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此 IMA 目标吗？")) return;
    try {
      const res = await fetch(`/api/settings/ima-targets/${id}`, { method: "DELETE" });
      if (res.ok) {
        const refreshRes = await fetch("/api/settings/ima-targets");
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setTargets(refreshData.data || []);
        }
      }
    } catch {
      setError("删除失败");
    }
  };

  const handleHealthCheck = async () => {
    setCheckingHealth(true);
    setError("");
    try {
      const res = await fetch("/api/ima/health");
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessage || data.error || "检查连接失败");
      setHealth(data);
    } catch (err) {
      setHealth({
        configured: false,
        reachable: false,
        authValid: false,
        lastCheckedAt: new Date().toISOString(),
        errorCode: "IMA_HEALTH_FAILED",
        errorMessage: err instanceof Error ? err.message : "检查连接失败",
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  const healthLabel = health
    ? !health.configured
      ? "未配置"
      : !health.reachable
        ? "已配置但不可达"
        : !health.authValid
          ? "鉴权失败"
          : "正常"
    : targets.length > 0
      ? "待检查"
      : "未配置";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">IMA 知识库</h1>
          <p className="text-sm text-muted-foreground mt-1">配置您的个人 IMA 知识库同步目标</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>IMA 状态</span>
            <Badge
              variant={health?.configured && health.reachable && health.authValid ? "default" : "secondary"}
              className="text-xs"
            >
              {healthLabel}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {health?.workspace && (
            <p className="text-sm text-muted-foreground">知识库：{health.workspace}</p>
          )}
          {health?.lastCheckedAt && (
            <p className="text-xs text-muted-foreground">
              检查时间：{new Date(health.lastCheckedAt).toLocaleString("zh-CN")}
            </p>
          )}
          {health?.errorMessage && (
            <p className="text-sm text-destructive">{health.errorMessage}</p>
          )}
          <Button onClick={handleHealthCheck} disabled={checkingHealth} size="sm" variant="outline">
            {checkingHealth ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            {checkingHealth ? "检查中..." : "检查连接"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing targets */}
      {targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已配置的目标</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {targets.map((target) => (
              <div key={target.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{target.name}</span>
                    <Badge variant={target.isEnabled ? "default" : "secondary"} className="text-xs">
                      {target.isEnabled ? "启用" : "禁用"}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <>
                      <p className="text-xs text-muted-foreground">{target.baseUrl}</p>
                      <p className="text-xs text-muted-foreground">知识库 ID: {target.knowledgeBaseId}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8" onClick={() => handleDelete(target.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add new target */}
      {!showForm ? (
        <Button onClick={() => setShowForm(true)} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          添加 IMA 目标
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">添加新的 IMA 目标</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">名称</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：我的 IMA 知识库" className="h-9" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">API Base URL</label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.ima.qq.com" className="h-9" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Client ID</label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="您的 Client ID" className="h-9" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="您的 API Key" className="h-9" />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">知识库 ID</label>
                <Input value={knowledgeBaseId} onChange={(e) => setKnowledgeBaseId(e.target.value)} placeholder="目标知识库 ID" className="h-9" />
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleCreate} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                创建
              </Button>
              <Button onClick={resetForm} variant="outline" size="sm">取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {targets.length === 0 && !showForm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>暂未配置 IMA 知识库目标</p>
              <p>配置后，素材卡可以同步到您的 IMA 知识库</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
