"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const account = username.trim();
    if (!account || !password) {
      setError("请填写账号和密码");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(account)) {
      setError("账号只能包含数字和英文字母");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: account, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "登录失败");
      }

      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "账号或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="username">
          账号
        </label>
        <input
          id="username"
          type="text"
          placeholder="请输入账号"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "登录中..." : "登录"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 font-sans text-foreground">
      <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-gradient-to-br from-violet-200/40 to-transparent blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-gradient-to-tl from-indigo-200/40 to-transparent blur-[120px]" />

      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-border bg-card px-8 py-10 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md">
            <span className="text-lg font-bold text-white">申</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            申论素材采集台
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            使用账号和密码登录
          </p>
        </div>

        <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>}>
          <LoginForm />
        </Suspense>

        <div className="mt-8 border-t border-border pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            还没有账号？
            <Link href="/register" className="ml-1 font-medium text-violet-600 transition-colors hover:text-violet-500">
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
