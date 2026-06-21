import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { validateSession } from "@/lib/auth";
import { LoginClient } from "./LoginClient";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    const user = await validateSession(token).catch(() => null);
    if (user) {
      const target =
        resolvedSearchParams?.redirect &&
        resolvedSearchParams.redirect !== "/admin/login"
          ? resolvedSearchParams.redirect
          : "/admin";
      redirect(target);
    }
  }

  return (
    <AuthShell
      title="申论素材管理后台"
      description="请输入管理员账号和密码"
      variant="admin"
      footer={
        <p className="text-[10px] text-muted-foreground">
          申论素材采集台 &copy; {new Date().getFullYear()} All Rights Reserved.
        </p>
      }
    >
      <LoginClient />
    </AuthShell>
  );
}
