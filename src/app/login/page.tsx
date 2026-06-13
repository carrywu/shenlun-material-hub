"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Loader2 } from "lucide-react";

function UserLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 已登录用户访问登录页 → 跳走
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/check")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.authenticated) {
          const redirect = searchParams.get("redirect");
          router.replace(redirect && redirect !== "/login" ? redirect : "/articles");
        }
      })
      .catch(() => {
        /* 未登录或检查失败 → 停留在登录页 */
      });
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

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
        body: JSON.stringify({ username, password, context: "user" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "登录失败");
      }

      const redirect = searchParams.get("redirect") || "/articles";
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
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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
        {loading ? "登录中..." : "登录"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-blue-200/40 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-indigo-200/40 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[440px] px-8 py-10 bg-card border border-border rounded-2xl shadow-lg relative z-10 transition-all duration-300 hover:shadow-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 mb-4 shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            申论素材学习台
          </h1>
          <p className="text-xs text-muted-foreground mt-2">
            登录后开始学习
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">加载中...</div>}>
          <UserLoginForm />
        </Suspense>

        {/* Footer with register link */}
        <div className="text-center mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">
            还没有账号？
            <a href="/register" className="ml-1 text-blue-600 hover:text-blue-700 font-medium">
              立即注册
            </a>
          </p>
          <p className="text-[10px] text-muted-foreground">
            申论素材采集台 &copy; {new Date().getFullYear()} All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
