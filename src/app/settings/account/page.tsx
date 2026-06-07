"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理员",
  VERIFIED_USER: "认证用户",
  USER: "普通用户",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  VERIFIED_USER: "secondary",
  USER: "outline",
};

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("请填写所有字段");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码长度不能少于 6 个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "密码修改失败");
        toast.error(data.error || "密码修改失败");
        return;
      }

      toast.success("密码修改成功，请重新登录");
      // Password change invalidates all sessions — redirect to login
      router.push("/admin/login");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <User className="h-6 w-6 text-primary" />
            账号设置
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看账号信息和修改密码
          </p>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">用户名</span>
            <span className="text-sm font-medium">{user?.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">角色</span>
            <Badge variant={ROLE_VARIANTS[user?.role ?? "USER"]}>
              {ROLE_LABELS[user?.role ?? "USER"]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            修改密码
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-sm font-medium">
                当前密码
              </label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="请输入当前密码"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                新密码
              </label>
              <Input
                id="newPassword"
                type="password"
                placeholder="请输入新密码（至少 6 个字符）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium"
              >
                确认新密码
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "提交中..." : "修改密码"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
