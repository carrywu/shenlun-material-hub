"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 已登录用户访问登录页的跳转已由服务端组件 page.tsx 处理，
  // 此处不再需要客户端 useEffect + /api/auth/check 跳转逻辑。

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("请填写用户名和密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, context: "admin" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "登录失败");
      }

      // Redirect to the page user originally requested, or admin dashboard
      const redirect = searchParams.get("redirect") || "/admin";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "用户名或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 8 0 11-16 0 8 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <FormField label="账号" required>
        <Input
          id="username"
          type="text"
          placeholder="请输入账号"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />
      </FormField>

      <FormField label="密码" required>
        <Input
          id="password"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </FormField>

      <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "登录中..." : "登录管理后台"}
      </Button>
    </form>
  );
}

export function LoginClient() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
