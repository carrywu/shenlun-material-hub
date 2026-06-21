import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import type { AuthUser } from "@/lib/auth";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

vi.mock("@/components/RootNav", () => ({
  default: () => <div data-testid="root-nav" />,
}));

vi.mock("@/components/MobileBottomTab", () => ({
  MobileBottomTab: () => <div data-testid="mobile-bottom-tab" />,
}));

const user: AuthUser = {
  id: "user-1",
  username: "reader",
  role: "USER",
  status: "ACTIVE",
};

describe("AppShell", () => {
  beforeEach(() => {
    usePathname.mockReset();
  });

  it.each(["/login", "/register", "/admin/login"])(
    "renders %s without application navigation",
    (pathname) => {
      usePathname.mockReturnValue(pathname);
      render(<AppShell currentUser={user}>Auth content</AppShell>);

      expect(screen.getByText("Auth content")).toBeInTheDocument();
      expect(screen.queryByTestId("root-nav")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mobile-bottom-tab")).not.toBeInTheDocument();
    }
  );

  it("renders admin routes without frontend navigation", () => {
    usePathname.mockReturnValue("/admin/articles");
    render(<AppShell currentUser={user}>Admin content</AppShell>);

    expect(screen.getByText("Admin content")).toBeInTheDocument();
    expect(screen.queryByTestId("root-nav")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-tab")).not.toBeInTheDocument();
  });

  it("renders frontend routes with both frontend navigation surfaces", () => {
    usePathname.mockReturnValue("/articles");
    render(<AppShell currentUser={user}>Frontend content</AppShell>);

    expect(screen.getByTestId("root-nav")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-tab")).toBeInTheDocument();
    expect(screen.getByTestId("frontend-shell-main")).toBeInTheDocument();
  });
});
