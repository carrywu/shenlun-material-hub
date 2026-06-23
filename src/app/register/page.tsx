"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AuthShell } from "@/components/layout/AuthShell";
import { Loader2 } from "lucide-react";

function RegisterForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!username || username.length < 3) {
      setError("账号至少需要 3 个字符");
      return;
    }
    if (!password || password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }

    setLoading(true);

    try {
      // P8-T5: 邀请码可选——为空时不发送字段（后端创建 USER；填了则升级为 VERIFIED_USER）
      const payload: { username: string; password: string; invitationCode?: string } = {
        username,
        password,
      };
      const trimmedCode = invitationCode.trim();
      if (trimmedCode) {
        payload.invitationCode = trimmedCode;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "注册失败");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <FormField label="账号" required>
        <Input
          id="username"
          type="text"
          placeholder="请输入账号（至少 3 个字符）"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />
      </FormField>

      <FormField label="密码" required>
        <Input
          id="password"
          type="password"
          placeholder="请输入密码（至少 6 个字符）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </FormField>

      <FormField label="邀请码（可选）" helper="邀请码可选，填写后升级为认证用户（可生成素材卡）">
        <Input
          id="invitationCode"
          type="text"
          placeholder="留空则注册为普通用户"
          value={invitationCode}
          onChange={(e) => setInvitationCode(e.target.value)}
          disabled={loading}
        />
      </FormField>

      <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "注册中..." : "注册"}
      </Button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="注册新账号"
      description="请填写以下信息完成注册"
      variant="register"
      footer={
        <>
          <p className="text-sm text-muted-foreground">
            已有账号？
            <Link href="/login" className="ml-1 font-medium text-primary hover:underline dark:text-violet-300">
              前往登录
            </Link>
          </p>
          <p className="mt-3 text-[10px] text-muted-foreground">
            申论素材采集台 &copy; {new Date().getFullYear()} All Rights Reserved.
          </p>
        </>
      }
    >
      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
