import { describe, expect, it } from "vitest";

import {
  ADMIN_NAVIGATION_GROUPS,
  findActiveAdminNavigationItem,
} from "@/components/admin/admin-navigation";

describe("ADMIN_NAVIGATION_GROUPS", () => {
  it("uses the approved business grouping and route order", () => {
    expect(ADMIN_NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
      "概览",
      "内容运营",
      "自动化与 AI",
      "用户与权限",
      "系统维护",
    ]);
    expect(
      ADMIN_NAVIGATION_GROUPS.flatMap((group) =>
        group.items.map((item) => item.href)
      )
    ).toEqual([
      "/admin",
      "/admin/articles",
      "/admin/sources",
      "/admin/integrations/wechat-rss",
      "/admin/tasks",
      "/admin/sync-records",
      "/admin/settings/ai",
      "/admin/users",
      "/admin/invitations",
      "/admin/logs",
      "/admin/backup",
      "/admin/clean",
    ]);
  });

  it("uses distinct semantic icons for system logs and data cleaning", () => {
    const items = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items);
    expect(items.find((item) => item.href === "/admin/logs")?.icon).not.toBe(
      items.find((item) => item.href === "/admin/clean")?.icon
    );
  });
});

describe("findActiveAdminNavigationItem", () => {
  it("matches the overview exactly and nested admin routes by segment", () => {
    expect(findActiveAdminNavigationItem("/admin")?.name).toBe("系统概览");
    expect(findActiveAdminNavigationItem("/admin/articles/example")?.name).toBe(
      "文章管理"
    );
  });
});
