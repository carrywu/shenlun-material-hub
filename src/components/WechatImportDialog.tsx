"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface WechatImportDialogProps {
  sourceId: string;
  sourceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WechatImportDialog({
  sourceId,
  sourceName,
  open,
  onOpenChange,
  onSuccess,
}: WechatImportDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/collectors/wechat/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url.trim()], sourceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");
      
      alert(`导入成功！发现 ${data.discoveredCount} 篇，导入 ${data.importedCount} 篇`);
      setUrl("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "导入失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手动导入微信文章</DialogTitle>
          <DialogDescription>
            将单篇微信公众号文章链接导入到来源「{sourceName}」
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴微信公众号文章链接 (https://mp.weixin.qq.com/s/...)"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleImport} disabled={loading || !url.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
