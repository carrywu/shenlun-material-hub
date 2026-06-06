import Link from "next/link";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Settings, Sparkles, Upload, Link as LinkIcon, User } from "lucide-react";

export default async function SettingsPage() {
  // Verify user is logged in
  let currentUser = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      currentUser = await validateSession(token);
    }
  } catch {
    // ignore
  }

  if (!currentUser) {
    redirect("/admin/login?redirect=/settings");
  }

  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          个人设置
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理你的 AI 配置、IMA 同步目标和集成设置
        </p>
      </div>

      <div className="grid gap-4">
        {/* Account Settings */}
        <Link
          href="/settings/account"
          className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-muted/50 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">账号设置</h3>
              <p className="text-xs text-muted-foreground mt-1">
                查看账号信息、修改密码。
              </p>
            </div>
          </div>
        </Link>

        {/* AI Configuration */}
        <Link
          href="/settings/ai"
          className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-muted/50 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">AI 配置</h3>
              <p className="text-xs text-muted-foreground mt-1">
                配置 AI 模型、API Key 和参数。用于内容评估、素材卡生成和智能批注。
              </p>
            </div>
          </div>
        </Link>

        {/* IMA Sync */}
        <Link
          href="/settings/ima"
          className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-muted/50 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Upload className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">IMA 知识库</h3>
              <p className="text-xs text-muted-foreground mt-1">
                配置 IMA 知识库目标，同步已确认的素材卡到腾讯 IMA 知识库。
              </p>
            </div>
          </div>
        </Link>

        {/* Integrations — admin only for now */}
        {isAdmin && (
          <Link
            href="/admin/integrations/wewe-rss"
            className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-muted/50 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-md">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">外部集成</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  WeWe RSS、外部 WeRSS 等集成配置。
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Account info summary */}
        <div className="p-5 bg-muted/30 border border-dashed border-border rounded-xl">
          <h3 className="font-semibold text-sm text-muted-foreground">当前账号</h3>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>用户名：{currentUser.username}</p>
            <p>角色：{currentUser.role === "ADMIN" ? "管理员" : currentUser.role === "VERIFIED_USER" ? "认证用户" : "普通用户"}</p>
          </div>
        </div>

        {/* Admin link */}
        {isAdmin && (
          <Link
            href="/admin"
            className="block p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-all text-center text-sm text-muted-foreground hover:text-foreground"
          >
            → 前往管理后台
          </Link>
        )}
      </div>
    </div>
  );
}
