import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RootNav from "@/components/RootNav";
import type { AuthUser } from "@/lib/auth";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/navigation/AccountMenu", () => ({
  AccountMenu: ({ user }: { user: AuthUser }) => (
    <button type="button" aria-label={`${user.username} 账户菜单`}>
      {user.username}
    </button>
  ),
}));

const makeUser = (role: AuthUser["role"]): AuthUser => ({
  id: `${role.toLowerCase()}-1`,
  username: role.toLowerCase(),
  role,
  status: "ACTIVE",
});

describe("RootNav", () => {
  beforeEach(() => {
    usePathname.mockReset();
  });

  it("marks the current route semantically and renders one account trigger", () => {
    usePathname.mockReturnValue("/articles/example");
    render(<RootNav currentUser={makeUser("ADMIN")} />);

    expect(screen.getByRole("link", { name: "文章" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("button", { name: "admin 账户菜单" })).toBeVisible();
    expect(screen.queryByText("管理员")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "管理后台" })).not.toBeInTheDocument();
  });

  it("does not expose verified-only navigation to USER", () => {
    usePathname.mockReturnValue("/");
    render(<RootNav currentUser={makeUser("USER")} />);

    expect(screen.queryByRole("link", { name: "素材卡" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "检索" })).not.toBeInTheDocument();
  });
});
