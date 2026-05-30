"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  listUrl: string;
  urlPattern: string | null;
  paginationPattern: string | null;
  maxPages: number;
  isEnabled: boolean;
  lastCollectedAt: string | null;
  collectedCount: number;
}

interface ChannelManagerProps {
  sourceId: string;
  sourceName: string;
}

const emptyChannelForm = {
  name: "",
  listUrl: "",
  urlPattern: "",
  paginationPattern: "",
  maxPages: 3,
};

export function ChannelManager({ sourceId, sourceName }: ChannelManagerProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [form, setForm] = useState(emptyChannelForm);
  const [saving, setSaving] = useState(false);

  const fetchChannels = async () => {
    try {
      const res = await fetch(`/api/sources/${sourceId}/channels`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [sourceId]);

  function openCreate() {
    setEditingChannel(null);
    setForm(emptyChannelForm);
    setShowForm(true);
  }

  function openEdit(channel: Channel) {
    setEditingChannel(channel);
    setForm({
      name: channel.name,
      listUrl: channel.listUrl,
      urlPattern: channel.urlPattern ?? "",
      paginationPattern: channel.paginationPattern ?? "",
      maxPages: channel.maxPages,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.listUrl.trim()) {
      alert("栏目名称和列表页 URL 不能为空");
      return;
    }

    setSaving(true);
    try {
      const url = editingChannel
        ? `/api/sources/${sourceId}/channels/${editingChannel.id}`
        : `/api/sources/${sourceId}/channels`;
      const method = editingChannel ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          listUrl: form.listUrl,
          urlPattern: form.urlPattern || null,
          paginationPattern: form.paginationPattern || null,
          maxPages: form.maxPages,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }

      setShowForm(false);
      fetchChannels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(channel: Channel) {
    if (!confirm(`确定删除栏目「${channel.name}」？`)) return;
    try {
      const res = await fetch(`/api/sources/${sourceId}/channels/${channel.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      fetchChannels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleToggle(channel: Channel) {
    try {
      const res = await fetch(`/api/sources/${sourceId}/channels/${channel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !channel.isEnabled }),
      });
      if (!res.ok) throw new Error("操作失败");
      fetchChannels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-2">加载栏目...</div>;
  }

  return (
    <div className="mt-2 border-t pt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          采集栏目 ({channels.length})
        </span>
        <Button variant="ghost" size="icon-xs" onClick={openCreate} title="添加栏目">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {channels.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          未配置栏目 — 采集时将使用默认逻辑
        </p>
      ) : (
        <div className="space-y-1">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="flex items-center gap-2 text-xs rounded px-2 py-1 hover:bg-muted/50"
            >
              <Badge
                variant={ch.isEnabled ? "default" : "secondary"}
                className="text-[10px] shrink-0"
              >
                {ch.isEnabled ? "启用" : "停用"}
              </Badge>
              <span className="font-medium truncate">{ch.name}</span>
              <span className="text-muted-foreground truncate flex-1">
                {ch.listUrl.replace(/^https?:\/\//, "").slice(0, 40)}
              </span>
              {ch.collectedCount > 0 && (
                <span className="text-muted-foreground shrink-0">
                  {ch.collectedCount} 篇
                </span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5"
                  onClick={() => handleToggle(ch)}
                  title={ch.isEnabled ? "停用" : "启用"}
                >
                  <span className="text-[10px]">{ch.isEnabled ? "⏸" : "▶"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5"
                  onClick={() => openEdit(ch)}
                  title="编辑"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5"
                  onClick={() => handleDelete(ch)}
                  title="删除"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Channel Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "编辑栏目" : "添加栏目"}
            </DialogTitle>
            <DialogDescription>
              为「{sourceName}」配置采集栏目列表页
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                栏目名称 <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：政策解读、评论版"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                列表页 URL <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.listUrl}
                onChange={(e) => setForm((f) => ({ ...f, listUrl: e.target.value }))}
                placeholder="https://www.example.com/column/index.html"
              />
              <p className="text-xs text-muted-foreground">
                栏目文章列表页的完整 URL
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">URL 匹配模式（正则）</label>
              <Input
                value={form.urlPattern}
                onChange={(e) => setForm((f) => ({ ...f, urlPattern: e.target.value }))}
                placeholder="content/post_\d+\.html"
              />
              <p className="text-xs text-muted-foreground">
                只匹配符合此模式的文章链接，留空则匹配所有链接
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">分页 URL 模板</label>
              <Input
                value={form.paginationPattern}
                onChange={(e) => setForm((f) => ({ ...f, paginationPattern: e.target.value }))}
                placeholder="https://www.example.com/column/index_{page}.html"
              />
              <p className="text-xs text-muted-foreground">
                {"用 {page} 作为页码占位符，留空则自动尝试 index_N.html"}
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">最大采集页数</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={form.maxPages}
                onChange={(e) => setForm((f) => ({ ...f, maxPages: parseInt(e.target.value) || 3 }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editingChannel ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
