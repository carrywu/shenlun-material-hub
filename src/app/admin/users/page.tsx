"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  Ban,
  Key,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sessionCount?: number;
}

// ─── Role helpers ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理员",
  VERIFIED_USER: "认证用户",
  USER: "普通用户",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  VERIFIED_USER: "bg-blue-100 text-blue-800",
  USER: "bg-gray-100 text-gray-700",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "正常",
  DISABLED: "已禁用",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  DISABLED: "bg-red-100 text-red-800",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Create user form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("USER");
  const [creating, setCreating] = useState(false);

  // Reset password form state
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  function fetchUsers() {
    setRefreshing(true);
    fetch("/api/admin/users")
      .then((res) => {
        if (!res.ok) throw new Error("加载失败");
        return res.json();
      })
      .then((data) => {
        setUsers(data.items || []);
      })
      .catch(() => {
        toast.error("加载用户列表失败");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  // Initial load
  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => {
        if (!res.ok) throw new Error("加载失败");
        return res.json();
      })
      .then((data) => {
        setUsers(data.items || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error("加载用户列表失败");
        setLoading(false);
      });
  }, []);

  // ─── Create user ─────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("用户名和密码不能为空");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          email: newEmail.trim() || undefined,
          displayName: newDisplayName.trim() || undefined,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success(`用户 "${newUsername}" 创建成功`);
      setShowCreateDialog(false);
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setNewDisplayName("");
      setNewRole("USER");
      void fetchUsers();
    } catch {
      toast.error("创建用户失败");
    } finally {
      setCreating(false);
    }
  }

  // ─── Update user ─────────────────────────────────────────────────────────

  async function updateField(id: string, field: string, value: string) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "更新失败");
        return;
      }
      toast.success("更新成功");
      void fetchUsers();
    } catch {
      toast.error("更新失败");
    }
  }

  // ─── Reset password ──────────────────────────────────────────────────────

  async function handleResetPassword() {
    if (!showResetDialog || !resetPassword) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${showResetDialog}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "重置失败");
        return;
      }
      toast.success("密码重置成功，已清除该用户所有会话");
      setShowResetDialog(null);
      setResetPassword("");
    } catch {
      toast.error("重置密码失败");
    } finally {
      setResetting(false);
    }
  }

  // ─── Delete user ─────────────────────────────────────────────────────────

  async function handleDelete(id: string, username: string) {
    if (!confirm(`确认删除用户 "${username}"？此操作不可恢复。`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success(`用户 "${username}" 已删除`);
      void fetchUsers();
    } catch {
      toast.error("删除失败");
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">用户管理</h1>
          <p className="text-sm text-muted-foreground">管理系统用户账号、角色和权限</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setRefreshing(true); void fetchUsers(); }}
            disabled={refreshing}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            创建用户
          </button>
        </div>
      </div>

      {/* User table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <User className="mb-2 h-8 w-8 text-muted-foreground/50" />
            暂无用户数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">用户名</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">显示名</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">邮箱</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">角色</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">创建时间</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{u.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.displayName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                        {(u.role === "ADMIN" ? Shield : u.role === "VERIFIED_USER" ? ShieldCheck : User) && (
                          <span className="h-3 w-3">
                            {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : u.role === "VERIFIED_USER" ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          </span>
                        )}
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.status] || "bg-gray-100"}`}>
                        {STATUS_LABELS[u.status] || u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.status === "ACTIVE" ? (
                          <button
                            onClick={() => updateField(u.id, "status", "DISABLED")}
                            className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="禁用"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateField(u.id, "status", "ACTIVE")}
                            className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                            title="启用"
                          >
                            启用
                          </button>
                        )}
                        <button
                          onClick={() => { setShowResetDialog(u.id); setResetPassword(""); }}
                          className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-amber-50 hover:text-amber-600"
                          title="重置密码"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">创建新用户</h2>
              <button onClick={() => setShowCreateDialog(false)} className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">用户名 *</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="3-32 个字符"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">密码 *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">显示名称</label>
                <input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="可选"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">邮箱</label>
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="可选"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">角色</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="USER">普通用户</option>
                  <option value="VERIFIED_USER">认证用户</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? "创建中..." : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">重置密码</h2>
              <button onClick={() => setShowResetDialog(null)} className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              重置后该用户的所有会话将被清除，需要重新登录。
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="新密码（至少 6 个字符）"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowResetDialog(null)}
                className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || resetPassword.length < 6}
                className="cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {resetting ? "重置中..." : "确认重置"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
