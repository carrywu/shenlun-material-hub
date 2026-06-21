import { describe, expect, it } from "vitest";

import {
  classifyShellRoute,
  getFrontendNavigation,
  isNavigationItemActive,
} from "@/components/navigation/navigation-config";

describe("classifyShellRoute", () => {
  it.each(["/login", "/register", "/admin/login"])(
    "classifies %s as an auth route",
    (pathname) => {
      expect(classifyShellRoute(pathname)).toBe("auth");
    }
  );

  it.each(["/admin", "/admin/articles", "/admin/settings/ai"])(
    "classifies %s as an admin route",
    (pathname) => {
      expect(classifyShellRoute(pathname)).toBe("admin");
    }
  );

  it.each(["/", "/articles", "/settings/account"])(
    "classifies %s as a frontend route",
    (pathname) => {
      expect(classifyShellRoute(pathname)).toBe("frontend");
    }
  );
});

describe("getFrontendNavigation", () => {
  it("limits USER navigation to the approved learning routes", () => {
    expect(getFrontendNavigation("USER").map((item) => item.href)).toEqual([
      "/",
      "/articles",
      "/review",
      "/settings",
    ]);
  });

  it.each(["VERIFIED_USER", "ADMIN"] as const)(
    "adds card and search routes for %s",
    (role) => {
      expect(getFrontendNavigation(role).map((item) => item.href)).toEqual([
        "/",
        "/articles",
        "/cards",
        "/search",
        "/review",
        "/settings",
      ]);
    }
  );
});

describe("isNavigationItemActive", () => {
  it("matches the homepage exactly", () => {
    expect(isNavigationItemActive("/", "/")).toBe(true);
    expect(isNavigationItemActive("/articles", "/")).toBe(false);
  });

  it("matches nested routes without matching similarly prefixed routes", () => {
    expect(isNavigationItemActive("/articles/example", "/articles")).toBe(true);
    expect(isNavigationItemActive("/articles-archive", "/articles")).toBe(false);
  });
});
