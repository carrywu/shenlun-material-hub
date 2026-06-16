"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, TestTube, Trash2, Rss, CheckCircle, Loader2, Power, PowerOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface ConfigData {
  configured: boolean;
  id?: string;
  isEnabled?: boolean;
  baseUrl?: string;
  accessKey?: string;
  secretKeyConfigured?: boolean;
  dbPath?: string;
  syncMode?: string;
  updatedAt?: string;
  authStatus?: "valid" | "expired" | "unknown";
}

export default function UserWechatRssSettingsPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();

  // 非 admin 直访此 URL → 重定向回 /settings
  useEffect(() => {
    if (user !== null && !isAdmin) {
      toast.warning("微信 RSS 集成仅管理员可用");
      router.replace("/settings");
    }
  }, [user, isAdmin, router]);

  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    feedCount?: number;
    authStatus?: "valid" | "expired" | "unknown";
  } | null>(null);

  const [baseUrl, setBaseUrl] = useState("http://localhost:8001");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [dbPath, setDbPath] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (user !== null && !isAdmin) {
      return () => { cancelled = true; };
    }
    fetch("/api/settings/integrations/wechat-rss")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setConfig(data);
          if (data.configured) {
            setBaseUrl(data.baseUrl || "http://localhost:8001");
            setAccessKey(data.accessKey || "");
            setDbPath(data.dbPath || "");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("加载配置失败:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  async function handleSave() {
    if (!baseUrl.trim()) {
      toast.warning("请填写 we-mp-rss 服务地址");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { baseUrl: baseUrl.trim(), dbPath: dbPath.trim(), syncMode: "auto" };
      // 只有填了 secretKey 才提交（不填则保留旧值，后端处理）
      if (accessKey.trim()) body.accessKey = accessKey.trim();
      if (secretKey.trim()) body.secretKey = secretKey.trim();

      const res = await fetch("/api/settings/integrations/wechat-rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig({ ...data });
        // 清空 secretKey 输入（安全：不回填）
        setSecretKey("");
        toast.success("微信 RSS 配置已保存");
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
      const body: Record<string, string> = { baseUrl: baseUrl.trim() };
      if (accessKey.trim()) body.accessKey = accessKey.trim();
      if (secretKey.trim()) body.secretKey = secretKey.trim();

      const res = await fetch("/api/settings/integrations/wechat-rss/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      setTestResult({ success: false, message: "请求失败" });
      toast.error("测试连接失败");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定删除微信 RSS 配置？已入库的文章不会被删除。")) return;
    try {
      const res = await fetch("/api/settings/integrations/wechat-rss", { method: "DELETE" });
      if (res.ok) {
        setConfig({ configured: false });
        setBaseUrl("http://localhost:8001");
        setAccessKey("");
        setSecretKey("");
        setDbPath("");
        setTestResult(null);
        toast.success("微信 RSS 配置已删除");
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleToggle() {
    if (!config?.configured) return;
    const newEnabled = !config.isEnabled;
    try {
      const res = await fetch("/api/settings/integrations/wechat-rss", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: newEnabled }),
      });
      if (res.ok) {
        setConfig({ ...config, isEnabled: newEnabled });
        toast.success(newEnabled ? "已启用" : "已禁用");
      }
    } catch {
      toast.error("操作失败");
    }
  }

  if (loading || user === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  // authStatus 图标
  const authStatusBadge = () => {
    const status = testResult?.authStatus ?? config?.authStatus;
    if (!status) return null;
    switch (status) {
      case "valid":
        return <Badge variant="outline" className="border-green-300 text-green-700"><ShieldCheck className="h-3 w-3 mr-1" />授权有效</Badge>;
      case "expired":
        return <Badge variant="outline" className="border-amber-300 text-amber-700"><ShieldAlert className="h-3 w-3 mr-1" />授权可能过期</Badge>;
      default:
        return <Badge variant="outline">授权状态未知</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Rss className="h-5 w-5" />
              微信 RSS 集成
            </h1>
            <p className="text-sm text-muted-foreground">
              配置 we-mp-rss 服务连接，用于微信公众号内容采集
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 连接状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              连接状态
              {config?.configured ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" /> 已配置
                </Badge>
              ) : (
                <Badge variant="secondary">未配置</Badge>
              )}
              {config?.configured && config.isEnabled !== undefined && (
                <Badge variant={config.isEnabled ? "default" : "outline"}>
                  {config.isEnabled ? "已启用" : "已禁用"}
                </Badge>
              )}
              {authStatusBadge()}
              {config?.secretKeyConfigured && (
                <Badge variant="outline" className="border-green-300 text-green-700">
                  AK/SK 已配置
                </Badge>
              )}
            </CardTitle>
            {config?.updatedAt && (
              <CardDescription>
                上次更新: {new Date(config.updatedAt).toLocaleString("zh-CN")}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TestTube className="h-4 w-4 mr-1" />}
                测试连接
              </Button>
              {config?.configured && (
                <Button variant="outline" size="sm" onClick={handleToggle}>
                  {config.isEnabled ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-1" /> 禁用
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-1" /> 启用
                    </>
                  )}
                </Button>
              )}
              {testResult && (
                <Badge variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success
                    ? `连接成功（${testResult.feedCount ?? 0} 个公众号）`
                    : `失败: ${testResult.message}`}
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
              填写 we-mp-rss 服务地址和 AK-SK 认证信息，用于采集微信公众号文章
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">we-mp-rss 服务地址</label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="mt-1"
                placeholder="http://localhost:8001"
              />
              <p className="text-xs text-muted-foreground mt-1">
                we-mp-rss 实例地址，默认为本地部署的 http://localhost:8001
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">AK-SK 认证</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="text"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="Access Key"
                />
                <Input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder={config?.secretKeyConfigured ? "Secret Key（已配置，留空保留）" : "Secret Key"}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                we-mp-rss 的 AK-SK 认证密钥，格式：Authorization: AK-SK accessKey:secretKey
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">SQLite 数据库路径（可选）</label>
              <Input
                type="text"
                value={dbPath}
                onChange={(e) => setDbPath(e.target.value)}
                className="mt-1"
                placeholder="infra/wechat-rss/we-mp-rss/data/we_mp_rss.db"
              />
              <p className="text-xs text-muted-foreground mt-1">
                当 API 不可用时，系统会尝试读取 SQLite 数据库作为备用数据源（只读）
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {saving ? "保存中..." : "保存配置"}
              </Button>
              {config?.configured && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除配置
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. 部署并启动 we-mp-rss 实例（<a href="https://github.com/rachelos/we-mp-rss" target="_blank" rel="noopener noreferrer" className="underline">GitHub</a>）</p>
            <p>2. 在 we-mp-rss 中订阅你感兴趣的微信公众号</p>
            <p>3. 在此页面配置 we-mp-rss 的访问地址和 AK-SK 并保存</p>
            <p>4. 系统将通过 API 优先、SQLite 只读兜底的方式同步公众号文章</p>
            <p>5. 同步的文章仅你自己可见，其他用户无法访问</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
