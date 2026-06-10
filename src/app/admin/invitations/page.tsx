"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Shield, Plus } from "lucide-react";
import { toast } from "sonner";

interface InvitationUse {
  id: string;
  usedAt: string;
  user: { id: string; username: string; displayName: string | null };
}

interface InvitationItem {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  isEnabled: boolean;
  note: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  isExhausted: boolean;
  createdAt: string;
  updatedAt: string;
  uses: InvitationUse[];
}

export default function AdminInvitationsPage() {
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  async function fetchInvitations() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(data.items || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载邀请码失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/invitations");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载失败");
        if (!cancelled) setItems(data.items || []);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "加载邀请码失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createInvitation() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          note: note.trim() || undefined,
          isEnabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      toast.success(`邀请码 ${data.invitation.code} 已创建`);
      setMaxUses(1);
      setExpiresAt("");
      setNote("");
      void fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建邀请码失败");
    } finally {
      setCreating(false);
    }
  }

  async function updateInvitation(id: string, payload: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/admin/invitations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失败");
      toast.success("邀请码已更新");
      void fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Shield className="h-5 w-5 text-primary" />
            邀请码管理
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            创建认证邀请码，管理次数、过期时间、启用状态和备注。
          </p>
        </div>
        <button
          onClick={fetchInvitations}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[160px_220px_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">最大使用次数</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">过期时间</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">备注</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="用途、批次或发放对象"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={createInvitation}
              disabled={creating}
              className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {creating ? "创建中" : "创建"}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">邀请码</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">次数</th>
              <th className="px-4 py-3 text-left">过期时间</th>
              <th className="px-4 py-3 text-left">备注</th>
              <th className="px-4 py-3 text-left">使用记录</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>加载中...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>暂无邀请码</td>
              </tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-mono font-medium">{item.code}</td>
                <td className="px-4 py-3">
                  {item.isEnabled && !item.isExpired && !item.isExhausted ? "可用" : "不可用"}
                </td>
                <td className="px-4 py-3">{item.usedCount} / {item.maxUses}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.expiresAt ? new Date(item.expiresAt).toLocaleString("zh-CN") : "长期有效"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.note || "-"}</td>
                <td className="px-4 py-3">
                  {item.uses.length === 0 ? (
                    <span className="text-muted-foreground">未使用</span>
                  ) : (
                    <div className="space-y-1">
                      {item.uses.map((use) => (
                        <div key={use.id} className="text-xs">
                          {use.user.displayName || use.user.username}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => updateInvitation(item.id, { isEnabled: !item.isEnabled })}
                    className="text-xs text-primary hover:underline"
                  >
                    {item.isEnabled ? "禁用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
