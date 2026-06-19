"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, Ticket, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InvitationItem {
  id: string;
  code: string;
  status: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expiresAt: string | null;
  isExpired: boolean;
  isExhausted: boolean;
  isDisabled: boolean;
  createdAt: string;
  creator?: { username: string; displayName: string | null };
  uses: Array<{
    id: string;
    usedAt: string;
    user: { username: string; displayName: string | null };
  }>;
}

function getStatusLabel(invitation: InvitationItem) {
  if (invitation.isDisabled || invitation.status === "DISABLED") return "已作废";
  if (invitation.isExpired) return "已过期";
  if (invitation.isExhausted) return "已用完";
  return "正常";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "不过期";
}

export default function AdminInvitationsPage() {
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [disableTarget, setDisableTarget] = useState<InvitationItem | null>(null);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);

  async function fetchInvitations() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/invitations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      toast.error("加载邀请码失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void fetchInvitations());
  }, []);

  async function handleCreate() {
    const parsedMaxUses = Number(maxUses);
    if (!Number.isFinite(parsedMaxUses) || parsedMaxUses < 1) {
      toast.error("最大使用次数不能少于 1");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses: parsedMaxUses,
          expiresAt: neverExpires || !expiresAt ? undefined : expiresAt,
          neverExpires,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      toast.success(`邀请码已创建：${data.invitation.code}`);
      setShowCreateDialog(false);
      setMaxUses("1");
      setExpiresAt("");
      setNeverExpires(false);
      await fetchInvitations();
    } catch (error) {
      toast.error("创建邀请码失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDisable() {
    if (!disableTarget) return;
    try {
      const res = await fetch(`/api/admin/invitations/${disableTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISABLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "作废失败");
      toast.success("邀请码已作废");
      setDisableTarget(null);
      await fetchInvitations();
    } catch (error) {
      toast.error("作废邀请码失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    toast.success("邀请码已复制");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 data-testid="admin-invitations-page-header" className="text-lg font-semibold text-foreground">邀请码管理</h2>
          <p className="text-sm text-muted-foreground">创建、查看和作废注册邀请码</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void fetchInvitations()}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            刷新
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus />
            创建邀请码
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="暂无邀请码"
            description="点击「创建邀请码」生成第一个邀请码"
            className="py-16"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邀请码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>使用情况</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>创建人</TableHead>
                <TableHead>使用记录</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-mono font-medium">
                    {invitation.code}
                  </TableCell>
                  <TableCell>{getStatusLabel(invitation)}</TableCell>
                  <TableCell>
                    已用 {invitation.usedCount} 次，剩余 {invitation.remainingUses} 次
                  </TableCell>
                  <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                  <TableCell>
                    {invitation.creator?.displayName || invitation.creator?.username || "未知"}
                  </TableCell>
                  <TableCell>
                    {invitation.uses.length === 0
                      ? "暂无"
                      : invitation.uses
                          .map((use) => use.user.displayName || use.user.username)
                          .join("、")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="复制"
                        onClick={() => void copyCode(invitation.code)}
                      >
                        <Copy />
                      </Button>
                      {invitation.status !== "DISABLED" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDisableTarget(invitation)}
                        >
                          作废
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建邀请码</DialogTitle>
            <DialogDescription>
              默认 1 次使用、7 天后过期，可按发放场景调整。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="最大使用次数" required>
              <Input
                aria-label="最大使用次数"
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(event) => setNeverExpires(event.target.checked)}
              />
              不设置过期时间
            </label>
            {!neverExpires && (
              <FormField label="过期时间">
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "确认创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!disableTarget}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>作废邀请码</DialogTitle>
            <DialogDescription>
              作废后该邀请码不能继续注册，但已注册用户不会受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDisable}>
              <XCircle />
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
