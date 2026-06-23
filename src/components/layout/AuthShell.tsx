import { BookOpenText, ShieldCheck, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";

const icons = {
  login: BookOpenText,
  register: UserPlus,
  admin: ShieldCheck,
};

export function AuthShell({
  children,
  description,
  footer,
  title,
  variant = "login",
}: {
  children: React.ReactNode;
  description: string;
  footer?: React.ReactNode;
  title: string;
  variant?: keyof typeof icons;
}) {
  const Icon = icons[variant];

  return (
    <main
      data-testid="auth-shell"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <section className="relative z-10 w-full max-w-[440px] rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10">
        <header className="mb-8 text-center">
          <div
            className={cn(
              "mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </div>
          <h1
            data-testid={variant === "admin" ? "login-page-header" : undefined}
            className="text-2xl font-bold tracking-tight"
          >
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </header>

        {children}

        {footer && (
          <footer className="mt-8 border-t border-border pt-6 text-center">
            {footer}
          </footer>
        )}
      </section>
    </main>
  );
}
