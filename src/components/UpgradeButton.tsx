"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function UpgradeButton() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/upgrade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationCode: code }),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success("升级成功，请刷新页面");
        setOpen(false);
        setTimeout(() => location.reload(), 800);
      } else {
        toast.error(j.error ?? "升级失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="default" size="sm">
        输入邀请码升级
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>升级为认证用户</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            输入邀请码后可使用自己的 AI 配置生成素材卡。
          </DialogDescription>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="邀请码"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={upgrade} disabled={loading || !code.trim()}>
              {loading ? "处理中..." : "升级"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
