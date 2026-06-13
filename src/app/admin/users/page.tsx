"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  Users,
  Ban,
  Key,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      // Optimistically add new user to list
      if (data.user) {
        setUsers(prev => [data.user as UserItem, ...prev]);
      }
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
      // Contextual success messages
      if (field === "status") {
        if (value === "DISABLED") {
          toast.success("用户已禁用，该用户的所有会话已被撤销");
        } else {
          toast.success("用户已启用");
        }
      } else {
        toast.success("更新成功");
      }
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

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">用户管理</h2>
          <p className="text-sm text-muted-foreground">管理系统用户账号、角色和权限</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { setRefreshing(true); void fetchUsers(); }}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            刷新
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
          >
            <UserPlus />
            创建用户
          </Button>
        </div>
      </div>

      {/* User table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="暂无用户数据" description="点击「创建用户」添加第一个用户" className="py-16" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>显示名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-foreground">{u.username}</TableCell>
                  <TableCell className="text-muted-foreground">{u.displayName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                      {(u.role === "ADMIN" ? Shield : u.role === "VERIFIED_USER" ? ShieldCheck : User) && (
                        <span className="h-3 w-3">
                          {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : u.role === "VERIFIED_USER" ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        </span>
                      )}
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.status] || "bg-gray-100"}`}>
                      {STATUS_LABELS[u.status] || u.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {u.status === "ACTIVE" ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => updateField(u.id, "status", "DISABLED")}
                          title="禁用"
                        >
                          <Ban />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => updateField(u.id, "status", "ACTIVE")}
                          title="启用"
                        >
                          启用
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => { setShowResetDialog(u.id); setResetPassword(""); }}
                        title="重置密码"
                      >
                        <Key />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create User Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">创建新用户</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreateDialog(false)}>
                <X />
              </Button>
            </div>
            <div className="space-y-3">
              <FormField label="用户名" required>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="3-32 个字符"
                />
              </FormField>
              <FormField label="密码" required>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                />
              </FormField>
              <FormField label="显示名称">
                <Input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="可选"
                />
              </FormField>
              <FormField label="邮箱">
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="可选"
                />
              </FormField>
              <FormField label="角色">
                <Select value={newRole} onValueChange={(val) => setNewRole(val as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">普通用户</SelectItem>
                    <SelectItem value="VERIFIED_USER">认证用户</SelectItem>
                    <SelectItem value="ADMIN">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "创建中..." : "创建"}
              </Button>
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
              <Button variant="ghost" size="icon-sm" onClick={() => setShowResetDialog(null)}>
                <X />
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              重置后该用户的所有会话将被清除，需要重新登录。
            </p>
            <FormField label="新密码" required helper="至少 6 个字符">
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="新密码（至少 6 个字符）"
              />
            </FormField>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(null)}
              >
                取消
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={resetting || resetPassword.length < 6}
              >
                {resetting ? "重置中..." : "确认重置"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
