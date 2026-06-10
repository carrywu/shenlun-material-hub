import { describe, expect, it } from "vitest";
import { subscriptionVisibilityWhere } from "../data-isolation";

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

  it("returns OR with 3 conditions for VERIFIED_USER", () => {
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
    expect(result.OR).toHaveLength(3);

    // Condition 1: subscribed sources
    expect(result.OR[0]).toEqual({
      source: { weweSubscriptions: { some: { userId: "user-1", status: "active" } } },
    });

    // Condition 2: own content
    expect(result.OR[1]).toEqual({ ownerUserId: "user-1" });

    // Condition 3: null owner (system shared / legacy)
    expect(result.OR[2]).toEqual({ ownerUserId: null });
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
    expect(result.OR).toHaveLength(3);

    expect(result.OR[0]).toEqual({
      source: { weweSubscriptions: { some: { userId: "user-2", status: "active" } } },
    });
    expect(result.OR[1]).toEqual({ ownerUserId: "user-2" });
    expect(result.OR[2]).toEqual({ ownerUserId: null });
  });
});
