import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { validateSession } from "@/lib/auth";
import { LoginClient } from "./LoginClient";

export default async function UserLoginPage({
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
        resolvedSearchParams.redirect !== "/login"
          ? resolvedSearchParams.redirect
          : "/articles";
      redirect(target);
    }
  }

  return (
    <AuthShell
      title="申论素材学习台"
      description="登录后开始学习"
      footer={
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            还没有账号？
            <Link href="/register" className="ml-1 font-medium text-primary hover:underline dark:text-violet-300">
              立即注册
            </Link>
          </p>
          <p className="text-[10px] text-muted-foreground">
            申论素材采集台 &copy; {new Date().getFullYear()} All Rights Reserved.
          </p>
        </>
      }
    >
      <LoginClient />
    </AuthShell>
  );
}
