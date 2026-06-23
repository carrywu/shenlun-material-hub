import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/components/admin/AdminShell";

const usePathname = vi.fn();
const router = { push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => router,
}));

describe("AdminShell", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/admin");
    router.push.mockReset();
    router.refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ username: "admin", role: "ADMIN" }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders grouped navigation without fabricated system status", async () => {
    render(<AdminShell>Admin content</AdminShell>);

    expect(await screen.findByTestId("admin-shell-heading")).toHaveTextContent(
      "系统概览"
    );
    expect(screen.getByRole("link", { name: "申论素材" })).toHaveAttribute(
      "href",
      "/admin"
    );
    expect(screen.queryByText("申论素材后台")).not.toBeInTheDocument();
    expect(screen.getByText("内容运营")).toBeVisible();
    expect(screen.getByText("自动化与 AI")).toBeVisible();
    expect(screen.getByText("用户与权限")).toBeVisible();
    expect(screen.getByText("系统维护")).toBeVisible();
    expect(screen.queryByText(/系统状态|正常运行|当前时间|在线/)).not.toBeInTheDocument();
  });

  it("preserves the desktop collapse contract", async () => {
    render(<AdminShell>Admin content</AdminShell>);
    await screen.findByTestId("admin-shell-heading");

    const sidebar = screen.getByTestId("admin-sidebar");
    const toggle = screen.getByTestId("admin-sidebar-toggle");
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the mobile drawer and closes it with Escape or its close button", async () => {
    render(<AdminShell>Admin content</AdminShell>);
    await screen.findByTestId("admin-shell-heading");
    const trigger = screen.getByTestId("admin-mobile-menu-trigger");

    fireEvent.click(trigger);
    expect(await screen.findByTestId("admin-mobile-drawer")).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "关闭后台导航" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });
});
