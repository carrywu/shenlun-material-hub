import { describe, expect, it } from "vitest";
import {
  subscriptionVisibilityWhere,
  contentVisibilityWhere,
  ownerScopeWhere,
  canAccessResource,
  canModifyResource,
} from "../data-isolation";

describe("subscriptionVisibilityWhere", () => {
  it("returns empty object for ADMIN (sees everything)", () => {
    const admin = {
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    };

    const result = subscriptionVisibilityWhere(admin);

    expect(result).toEqual({});
  });

  it("returns OR with 2 conditions for VERIFIED_USER (no null fallback)", () => {
    const user = {
      id: "user-1",
      username: "zhangsan",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    const result = subscriptionVisibilityWhere(user) as {
      OR: unknown[];
    };

    expect(result).toHaveProperty("OR");
    expect(Array.isArray(result.OR)).toBe(true);
    expect(result.OR).toHaveLength(2);

    // Condition 1: subscribed sources
    expect(result.OR[0]).toEqual({
      source: { weweSubscriptions: { some: { userId: "user-1", status: "active" } } },
    });

    // Condition 2: own content
    expect(result.OR[1]).toEqual({ ownerUserId: "user-1" });
  });

  it("returns same OR conditions for USER as VERIFIED_USER", () => {
    const user = {
      id: "user-2",
      username: "lisi",
      role: "USER",
      status: "ACTIVE",
    };

    const result = subscriptionVisibilityWhere(user) as {
      OR: unknown[];
    };

    expect(result).toHaveProperty("OR");
    expect(Array.isArray(result.OR)).toBe(true);
    expect(result.OR).toHaveLength(2);

    expect(result.OR[0]).toEqual({
      source: { weweSubscriptions: { some: { userId: "user-2", status: "active" } } },
    });
    expect(result.OR[1]).toEqual({ ownerUserId: "user-2" });
  });

  it("does NOT include ownerUserId: null — users must subscribe to see content", () => {
    const user = {
      id: "user-3",
      username: "wangwu",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    const result = subscriptionVisibilityWhere(user) as {
      OR: unknown[];
    };

    const hasNullFallback = result.OR.some(
      (cond) => typeof cond === "object" && cond !== null && "ownerUserId" in cond && (cond as { ownerUserId: unknown }).ownerUserId === null,
    );
    expect(hasNullFallback).toBe(false);
  });
});

describe("contentVisibilityWhere", () => {
  it("returns empty object for ADMIN (sees everything)", () => {
    const admin = {
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    };

    const result = contentVisibilityWhere(admin);

    expect(result).toEqual({});
  });

  it("returns OR with 2 conditions for non-admin (public + own)", () => {
    const user = {
      id: "user-1",
      username: "zhangsan",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    const result = contentVisibilityWhere(user) as {
      OR: unknown[];
    };

    expect(result).toHaveProperty("OR");
    expect(Array.isArray(result.OR)).toBe(true);
    expect(result.OR).toHaveLength(2);

    expect(result.OR[0]).toEqual({ visibility: "public" });
    expect(result.OR[1]).toEqual({ ownerUserId: "user-1" });
  });

  it("does NOT include ownerUserId: null — legacy data requires migration", () => {
    const user = {
      id: "user-1",
      username: "zhangsan",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    const result = contentVisibilityWhere(user) as {
      OR: unknown[];
    };

    const hasNullFallback = result.OR.some(
      (cond) => typeof cond === "object" && cond !== null && "ownerUserId" in cond && (cond as { ownerUserId: unknown }).ownerUserId === null,
    );
    expect(hasNullFallback).toBe(false);
  });
});

describe("ownerScopeWhere — preserved null fallback for system-level data", () => {
  it("returns empty object for ADMIN", () => {
    const admin = {
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    };

    const result = ownerScopeWhere(admin);

    expect(result).toEqual({});
  });

  it("still includes null fallback for MaterialCard/SyncRecord system data", () => {
    const user = {
      id: "user-1",
      username: "zhangsan",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    const result = ownerScopeWhere(user) as {
      OR: unknown[];
    };

    expect(result).toHaveProperty("OR");
    expect(result.OR).toHaveLength(2);

    // Should still include null for system-generated data
    expect(result.OR[0]).toEqual({ ownerUserId: "user-1" });
    expect(result.OR[1]).toEqual({ ownerUserId: null });
  });
});

describe("canAccessResource / canModifyResource — preserved null behavior", () => {
  it("allows access to null-owner resources (system shared)", () => {
    const user = {
      id: "user-1",
      username: "zhangsan",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    expect(canAccessResource(user, null)).toBe(true);
  });

  it("allows modify for owner only (not null-owner)", () => {
    const user = {
      id: "user-1",
      username: "zhangsan",
      role: "VERIFIED_USER",
      status: "ACTIVE",
    };

    // null-owner resources can only be modified by admin
    expect(canModifyResource(user, null)).toBe(false);
    expect(canModifyResource(user, "user-1")).toBe(true);
  });
});
