"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const IMPORT_POLL_TIMEOUT = 120_000; // 120s
const IMPORT_POLL_INTERVAL = 3_000; // 3s

interface WechatImportDialogProps {
  sourceId: string;
  sourceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportPhase = "idle" | "submitting" | "polling" | "success" | "timeout" | "error";

export function WechatImportDialog({
  sourceId,
  sourceName,
  open,
  onOpenChange,
  onSuccess,
}: WechatImportDialogProps) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  // 清理轮询定时器
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current = true;
  }, []);

  // 对话框关闭时清理状态（替代 useEffect，避免 effect 内同步 setState）
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      cleanup();
      setPhase("idle");
      setElapsed(0);
      setErrorMsg("");
    }
    onOpenChange(nextOpen);
  }, [cleanup, onOpenChange]);

  async function handleImport() {
    if (!url.trim()) return;
    abortRef.current = false;
    setPhase("submitting");
    setElapsed(0);
    setErrorMsg("");

    try {
      // 提交导入请求
      const res = await fetch("/api/collectors/wechat/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url.trim()], sourceId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPhase("error");
        setErrorMsg(data.error || "导入失败");
        return;
      }

      // 后端已完成轮询并返回结果（后端内部 120s 超时轮询 we-mp-rss task）
      // 前端只需跟踪等待时间并展示结果
      if (data.success) {
        setPhase("success");
        toast.success(`导入成功！发现 ${data.discoveredCount} 篇，导入 ${data.importedCount} 篇`);
        onSuccess?.();
      } else if (data.errors && data.errors.length > 0) {
        // 部分失败
        const hasTimeout = data.errors.some((e: string) => e.includes("超时") || e.includes("timeout") || e.includes("we-mp-rss 管理界面"));
        if (hasTimeout) {
          setPhase("timeout");
          setErrorMsg("导入超时，文章可能仍在 we-mp-rss 中处理");
        } else {
          setPhase("error");
          setErrorMsg(data.errors[0]);
        }
      } else {
        setPhase("error");
        setErrorMsg(data.error || "导入失败");
      }
    } catch (err) {
      if (abortRef.current) return;
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "请求失败，请稍后重试");
    }
  }

  // 跟踪等待时间（仅在 submitting 阶段）
  useEffect(() => {
    if (phase === "submitting") {
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [phase]);

  const handleClose = () => {
    cleanup();
    setUrl("");
    setPhase("idle");
    setElapsed(0);
    setErrorMsg("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            disabled={phase === "submitting"}
          />
        </div>

        {/* 进度/状态展示 */}
        {phase === "submitting" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              正在导入，we-mp-rss 正在抓取文章内容...
              {elapsed > 0 && <span className="ml-1">（{elapsed}s）</span>}
            </span>
          </div>
        )}

        {phase === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-600 py-2">
            <CheckCircle className="h-4 w-4" />
            <span>导入成功！</span>
          </div>
        )}

        {phase === "timeout" && (
          <div className="flex items-center gap-2 text-sm text-amber-600 py-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{errorMsg || "导入超时"}，请在 we-mp-rss 管理界面查看结果</span>
          </div>
        )}

        {phase === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive py-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{errorMsg || "导入失败，请稍后重试"}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {phase === "success" || phase === "timeout" || phase === "error" ? "关闭" : "取消"}
          </Button>
          {phase === "idle" && (
            <Button onClick={handleImport} disabled={!url.trim()}>
              开始导入
            </Button>
          )}
          {phase === "submitting" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              导入中（最多 120s）
            </Button>
          )}
          {(phase === "success" || phase === "timeout" || phase === "error") && (
            <Button onClick={() => { setPhase("idle"); setUrl(""); setErrorMsg(""); }}>
              重新导入
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
