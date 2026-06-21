import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/components/navigation/AccountMenu";
import type { AuthUser } from "@/lib/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const makeUser = (role: AuthUser["role"]): AuthUser => ({
  id: `${role.toLowerCase()}-1`,
  username: role.toLowerCase(),
  role,
  status: "ACTIVE",
});

describe("AccountMenu", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("limits USER to account settings and logout", async () => {
    render(<AccountMenu user={makeUser("USER")} />);
    fireEvent.click(screen.getByRole("button", { name: "user 账户菜单" }));

    expect(await screen.findByRole("menuitem", { name: "账号设置" })).toHaveAttribute(
      "href",
      "/settings/account"
    );
    expect(screen.getByRole("menuitem", { name: "退出登录" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "AI 设置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "IMA 设置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /管理后台/ })).not.toBeInTheDocument();
  });

  it("shows personal integration settings to VERIFIED_USER and closes with Escape", async () => {
    render(<AccountMenu user={makeUser("VERIFIED_USER")} />);
    const trigger = screen.getByRole("button", { name: "verified_user 账户菜单" });
    fireEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: "AI 设置" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "IMA 设置" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: /管理后台/ })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("adds the admin entry for ADMIN", async () => {
    render(<AccountMenu user={makeUser("ADMIN")} />);
    fireEvent.click(screen.getByRole("button", { name: "admin 账户菜单" }));

    expect(await screen.findByRole("menuitem", { name: /管理后台/ })).toHaveAttribute(
      "href",
      "/admin"
    );
  });
});
