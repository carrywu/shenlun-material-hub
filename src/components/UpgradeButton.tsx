"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white p-6 rounded max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">升级为认证用户</h3>
            <p className="text-sm text-muted-foreground mb-3">
              输入邀请码后可使用自己的 AI 配置生成素材卡。
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="邀请码"
              className="border rounded px-2 py-1 w-full mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={upgrade} disabled={loading || !code.trim()} size="sm">
                {loading ? "处理中..." : "升级"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
