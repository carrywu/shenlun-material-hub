"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";

function RegisterForm() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    const account = username.trim();
    const nickname = displayName.trim();
    if (!account) {
      setError("请输入账号");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(account)) {
      setError("账号只能包含数字和英文字母");
      return;
    }
    if (!nickname) {
      setError("昵称不能为空");
      return;
    }
    if (nickname.length > 30) {
      setError("昵称不能超过 30 个字符");
      return;
    }
    if (!password || password.length < 6 || password.length > 18) {
      setError("密码长度应为 6-18 位");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: account,
          displayName: nickname,
          password,
          invitationCode: invitationCode.trim() || undefined,
        }),
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

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2" htmlFor="username">
          账号
        </label>
        <Input
          id="username"
          type="text"
          placeholder="请输入账号（数字或英文字母）"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="py-3 rounded-xl"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2" htmlFor="displayName">
          昵称
        </label>
        <Input
          id="displayName"
          type="text"
          placeholder="请输入昵称（1-30 个字符）"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="py-3 rounded-xl"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2" htmlFor="password">
          密码
        </label>
        <Input
          id="password"
          type="password"
          placeholder="请输入密码（6-18 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="py-3 rounded-xl"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2" htmlFor="invitationCode">
          邀请码（可选）
        </label>
        <Input
          id="invitationCode"
          type="text"
          placeholder="有邀请码可填写，注册后成为认证用户"
          value={invitationCode}
          onChange={(e) => setInvitationCode(e.target.value)}
          className="py-3 rounded-xl"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98]"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>注册中...</span>
          </>
        ) : (
          <span>注 册</span>
        )}
      </button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-violet-200/40 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-indigo-200/40 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[440px] px-8 py-10 bg-card border border-border rounded-2xl shadow-lg relative z-10 transition-all duration-300 hover:shadow-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            注册新账号
          </h1>
          <p className="text-xs text-muted-foreground mt-2">
            请填写以下信息完成注册
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">加载中...</div>}>
          <RegisterForm />
        </Suspense>

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            已有账号？
            <Link
              href="/login"
              className="text-violet-600 hover:text-violet-500 font-medium transition-colors duration-200 ml-1"
            >
              前往登录
            </Link>
          </p>
          <p className="text-[10px] text-muted-foreground mt-3">
            申论素材采集台 &copy; {new Date().getFullYear()} All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
