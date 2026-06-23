import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { validateSession, type AuthUser } from "@/lib/auth";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export const metadata: Metadata = {
  title: "申论素材采集台",
  description: "采集官方文章，生成 AI 素材卡，同步至 ima 知识库",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read current user from session cookie
  let currentUser: AuthUser | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      currentUser = await validateSession(token);
    }
  } catch {
    // cookies() may throw in edge cases; treat as unauthenticated
  }

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <AuthProvider user={currentUser}>
          <Toaster position="top-right" richColors />
          <AppShell currentUser={currentUser}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
