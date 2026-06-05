"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Download, ShieldAlert } from "lucide-react";

interface BackupPreview {
  summary: {
    createdAt: string;
    databaseBytes: number;
    uploadCount: number;
    uploadBytes: number;
  };
  backupCounts: {
    contentItems: number;
    sources: number;
    materialCards: number;
  };
  currentCounts: {
    contentItems: number;
    sources: number;
    materialCards: number;
  };
  willOverwrite: boolean;
}

export default function AdminBackupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");

  async function exportBackup() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backup/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "shenlun-backup.json.gz";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  async function uploadBackup(apply = false) {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apply", String(apply));
      if (apply) {
        formData.append("confirmPassword", confirmPassword);
      }

      const res = await fetch("/api/admin/backup/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "导入失败");
      }
      setPreview(json.preview);
    } catch (error) {
      alert(error instanceof Error ? error.message : "导入失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">数据备份</h2>
        <p className="text-xs text-[#a1a1aa] mt-1">导出当前 SQLite 数据与上传文件，并支持 dry-run 恢复预览</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">导出备份</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={exportBackup} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            下载备份压缩包
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">恢复备份</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".gz" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => uploadBackup(false)} disabled={!file || loading}>
              <Upload className="mr-1.5 h-4 w-4" />
              Dry-run 预览
            </Button>
          </div>

          {preview && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-sm font-medium">恢复将覆盖当前数据库与 uploads 目录</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-medium">备份内容</p>
                  <p>文章 {preview.backupCounts.contentItems}</p>
                  <p>来源 {preview.backupCounts.sources}</p>
                  <p>素材卡 {preview.backupCounts.materialCards}</p>
                </div>
                <div>
                  <p className="font-medium">当前系统</p>
                  <p>文章 {preview.currentCounts.contentItems}</p>
                  <p>来源 {preview.currentCounts.sources}</p>
                  <p>素材卡 {preview.currentCounts.materialCards}</p>
                </div>
              </div>
              <Input
                type="password"
                placeholder="输入管理员密码确认恢复"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button variant="destructive" onClick={() => uploadBackup(true)} disabled={!confirmPassword || loading}>
                应用恢复
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
