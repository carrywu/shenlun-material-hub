"use client";

import { useEffect, useState } from "react";
import { UserPlus, RefreshCw, Users, Ban, Key } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: UserItem; role: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

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

  async function updateField(id: string, field: string, value: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "更新失败");
        return false;
      }
      // Contextual success messages
      if (field === "status") {
        if (value === "DISABLED") {
          toast.success("用户已禁用，该用户的所有会话已被撤销");
        } else {
          toast.success("用户已启用");
        }
      } else if (field === "role") {
        const updatedUser = users.find((u) => u.id === id);
        toast.success(`已将 ${updatedUser?.username || "该用户"} 的身份调整为${ROLE_LABELS[value] || value}`);
      } else {
        toast.success("更新成功");
      }
      void fetchUsers();
      return true;
    } catch {
      toast.error("更新失败");
      return false;
    }
  }

  async function confirmRoleChange() {
    if (!roleChangeTarget) return;
    setUpdatingRole(true);
    try {
      const ok = await updateField(roleChangeTarget.user.id, "role", roleChangeTarget.role);
      if (ok) setRoleChangeTarget(null);
    } finally {
      setUpdatingRole(false);
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
          <h2 data-testid="admin-users-page-header" className="text-lg font-semibold text-foreground">用户管理</h2>
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
                    <Select
                      value={u.role}
                      onValueChange={(role) => {
                        if (!role || role === u.role) return;
                        setRoleChangeTarget({ user: u, role });
                      }}
                    >
                      <SelectTrigger
                        aria-label={`调整 ${u.username} 身份`}
                        className="h-8 w-[128px]"
                      >
                        <span className="truncate">{ROLE_LABELS[u.role] || u.role}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">普通用户</SelectItem>
                        <SelectItem value="VERIFIED_USER">认证用户</SelectItem>
                        <SelectItem value="ADMIN">管理员</SelectItem>
                      </SelectContent>
                    </Select>
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
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) setShowCreateDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
          </DialogHeader>
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
                  <span className="truncate">{ROLE_LABELS[newRole] || "选择角色"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">普通用户</SelectItem>
                  <SelectItem value="VERIFIED_USER">认证用户</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog !== null} onOpenChange={(open) => { if (!open) setShowResetDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            重置后该用户的所有会话将被清除，需要重新登录。
          </DialogDescription>
          <FormField label="新密码" required helper="至少 6 个字符">
            <Input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="新密码（至少 6 个字符）"
            />
          </FormField>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleChangeTarget !== null} onOpenChange={(open) => { if (!open) setRoleChangeTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认调整用户身份</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {roleChangeTarget
              ? `确定将 ${roleChangeTarget.user.username} 的身份调整为「${ROLE_LABELS[roleChangeTarget.role] || roleChangeTarget.role}」吗？`
              : ""}
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleChangeTarget(null)}
              disabled={updatingRole}
            >
              取消
            </Button>
            <Button
              onClick={() => void confirmRoleChange()}
              disabled={updatingRole}
            >
              {updatingRole ? "调整中..." : "确认调整"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
