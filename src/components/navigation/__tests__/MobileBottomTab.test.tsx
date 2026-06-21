import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileBottomTab } from "@/components/MobileBottomTab";
import type { AuthUser } from "@/lib/auth";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

const makeUser = (role: AuthUser["role"]): AuthUser => ({
  id: `${role.toLowerCase()}-1`,
  username: role.toLowerCase(),
  role,
  status: "ACTIVE",
});

describe("MobileBottomTab", () => {
  beforeEach(() => {
    usePathname.mockReset();
  });

  it("limits verified users to five primary tabs and marks the active route", () => {
    usePathname.mockReturnValue("/cards/example");
    render(<MobileBottomTab currentUser={makeUser("VERIFIED_USER")} />);

    const navigation = screen.getByRole("navigation", { name: "移动端主导航" });
    expect(navigation).toHaveClass("pb-[env(safe-area-inset-bottom)]");
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "素材卡" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("link", { name: "检索" })).not.toBeInTheDocument();
  });

  it("does not expose card navigation to USER", () => {
    usePathname.mockReturnValue("/");
    render(<MobileBottomTab currentUser={makeUser("USER")} />);

    expect(screen.queryByRole("link", { name: "素材卡" })).not.toBeInTheDocument();
  });
});
