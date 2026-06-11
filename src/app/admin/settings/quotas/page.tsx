"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface RoleQuota {
  role: string;
  favoriteLimit: number;
}

const ROLE_LABELS: Record<string, string> = {
  USER: "普通用户 (USER)",
  VERIFIED_USER: "认证用户 (VERIFIED_USER)",
};

export default function RoleQuotasPage() {
  const [quotas, setQuotas] = useState<RoleQuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/role-quotas")
      .then((r) => r.json())
      .then((j) => setQuotas(j.data ?? []))
      .catch(() => toast.error("加载配额失败"))
      .finally(() => setLoading(false));
  }, []);

  async function update(role: string, favoriteLimit: number) {
    const res = await fetch("/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, favoriteLimit }),
    });
    if (res.ok) {
      toast.success(`${ROLE_LABELS[role] ?? role} 配额已更新`);
      const j = await res.json();
      setQuotas((prev) =>
        prev.map((q) => (q.role === role ? j.data : q))
      );
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "更新失败");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用户配额设置</h1>
        <p className="text-sm text-muted-foreground mt-1">
          配置每个角色的文章收藏上限。ADMIN 不限（不入库）。修改后立即生效。
        </p>
      </div>

      <div className="space-y-4">
        {quotas.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              暂无配额记录。请先在 staging 运行 <code>pnpm seed:role-quotas</code> 写入默认值（USER=100,
              VERIFIED_USER=300）。
            </CardContent>
          </Card>
        ) : (
          quotas.map((q) => <QuotaRow key={q.role} q={q} onSave={update} />)
        )}
      </div>
    </div>
  );
}

function QuotaRow({
  q,
  onSave,
}: {
  q: RoleQuota;
  onSave: (role: string, limit: number) => void;
}) {
  const [val, setVal] = useState(String(q.favoriteLimit));
  const roleLabel = ROLE_LABELS[q.role] ?? q.role;

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <span className="flex-1 font-medium">{roleLabel}</span>
        <Input
          type="number"
          min={0}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">篇</span>
        <Button
          size="sm"
          onClick={() => {
            const n = Number(val);
            if (!Number.isFinite(n) || n < 0) {
              toast.error("配额必须为非负整数");
              return;
            }
            onSave(q.role, n);
          }}
        >
          保存
        </Button>
      </CardContent>
    </Card>
  );
}
