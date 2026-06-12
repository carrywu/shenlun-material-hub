import { describe, expect, it } from "vitest";
import {
  contentVisibilityWhere,
  ownerScopeWhere,
  ownedResourceWhere,
  legacyAdminOnlyWhere,
  canAccessResource,
  canModifyResource,
} from "@/lib/data-isolation";
import type { AuthUser } from "@/lib/auth";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const admin: AuthUser = {
  id: "admin-1",
  username: "admin",
  role: "ADMIN",
  status: "ACTIVE",
};

const regularUser: AuthUser = {
  id: "user-a",
  username: "userA",
  role: "USER",
  status: "ACTIVE",
};

const _otherUser: AuthUser = {
  id: "user-b",
  username: "userB",
  role: "USER",
  status: "ACTIVE",
};

const verifiedUser: AuthUser = {
  id: "user-v",
  username: "verifiedA",
  role: "VERIFIED_USER",
  status: "ACTIVE",
};

// ─── Legacy null-owner data policy ────────────────────────────────────────────

describe("Legacy null-owner data policy (ownerUserId=null)", () => {
  /**
   * Policy decision:
   * - ownerUserId=null means "legacy public data" — imported before RBAC was enabled.
   * - Non-admin users CAN READ these items (via contentVisibilityWhere/ownerScopeWhere).
   * - Non-admin users CANNOT MODIFY null-owner items (canModifyResource returns false).
   * - Admin can do anything with null-owner items.
   */

  describe("contentVisibilityWhere", () => {
    it("admin sees everything including null-owner", () => {
      const where = contentVisibilityWhere(admin);
      expect(where).toEqual({});
    });

    it("regular user sees public, own, AND null-owner items", () => {
      const where = contentVisibilityWhere(regularUser);
      // P3: contentVisibilityWhere now also injects adminReviewStatus="approved"
      // for non-admin users, so use toMatchObject to allow extra fields.
      expect(where).toMatchObject({
        OR: [
          { visibility: "public" },
          { ownerUserId: "user-a" },
          { ownerUserId: null },
        ],
      });
    });
  });

  describe("ownerScopeWhere", () => {
    it("admin sees everything", () => {
      const where = ownerScopeWhere(admin);
      expect(where).toEqual({});
    });

    it("regular user sees own + null-owner items", () => {
      const where = ownerScopeWhere(regularUser);
      expect(where).toEqual({
        OR: [{ ownerUserId: "user-a" }, { ownerUserId: null }],
      });
    });
  });

  describe("canAccessResource", () => {
    it("admin can access null-owner items", () => {
      expect(canAccessResource(admin, null)).toBe(true);
    });

    it("regular user can READ null-owner items", () => {
      expect(canAccessResource(regularUser, null)).toBe(true);
    });

    it("regular user can READ own items", () => {
      expect(canAccessResource(regularUser, "user-a")).toBe(true);
    });

    it("regular user CANNOT access other user's private items", () => {
      expect(canAccessResource(regularUser, "user-b")).toBe(false);
    });

    it("regular user can access public items from other users", () => {
      expect(canAccessResource(regularUser, "user-b", "public")).toBe(true);
    });
  });

  describe("canModifyResource", () => {
    it("admin can modify null-owner items", () => {
      expect(canModifyResource(admin, null)).toBe(true);
    });

    it("regular user CANNOT modify null-owner items", () => {
      // This is the key policy: null-owner data is read-only for non-admins
      expect(canModifyResource(regularUser, null)).toBe(false);
    });

    it("regular user can modify own items", () => {
      expect(canModifyResource(regularUser, "user-a")).toBe(true);
    });

    it("regular user CANNOT modify other user's items", () => {
      expect(canModifyResource(regularUser, "user-b")).toBe(false);
    });
  });
});

// ─── P1-001: ownedResourceWhere & legacyAdminOnlyWhere ────────────────────────

describe("ownedResourceWhere — strict owner-only visibility (P1-001)", () => {
  /**
   * Policy: Non-admin users see ONLY their own data.
   * Legacy null-owner data is NOT visible to non-admins.
   * This replaces ownerScopeWhere in routes where legacy null data should be admin-only.
   */

  it("ADMIN sees everything (empty filter)", () => {
    const where = ownedResourceWhere(admin);
    expect(where).toEqual({});
  });

  it("USER sees only their own data (no legacy null)", () => {
    const where = ownedResourceWhere(regularUser);
    expect(where).toEqual({ ownerUserId: "user-a" });
    // Must NOT contain OR with null
    expect(where).not.toHaveProperty("OR");
  });

  it("VERIFIED_USER sees only their own data (no legacy null)", () => {
    const where = ownedResourceWhere(verifiedUser);
    expect(where).toEqual({ ownerUserId: "user-v" });
    expect(where).not.toHaveProperty("OR");
  });

  it("supports custom fieldName", () => {
    const where = ownedResourceWhere(regularUser, "userId");
    expect(where).toEqual({ userId: "user-a" });
  });

  it("ADMIN with custom fieldName still sees everything", () => {
    const where = ownedResourceWhere(admin, "userId");
    expect(where).toEqual({});
  });

  it("does NOT expose legacy null-owner data to non-admins", () => {
    const where = ownedResourceWhere(regularUser);
    const orConditions = (where as Record<string, unknown>).OR;
    expect(orConditions).toBeUndefined();
    // The filter is a simple equality, which Prisma interprets as
    // "ownerUserId equals user-a" — null values are excluded automatically
    expect((where as Record<string, unknown>).ownerUserId).toBe("user-a");
  });
});

describe("legacyAdminOnlyWhere — explicit null exclusion (P1-001)", () => {
  /**
   * Policy: Non-admin users see only their own data, with an explicit
   * "not null" guard. This is defense-in-depth: even if Prisma behavior
   * changes, null-owner records are explicitly excluded.
   */

  it("ADMIN sees everything (empty filter)", () => {
    const where = legacyAdminOnlyWhere(admin);
    expect(where).toEqual({});
  });

  it("USER sees only their own data with explicit null exclusion", () => {
    const where = legacyAdminOnlyWhere(regularUser);
    expect(where).toEqual({
      ownerUserId: { not: null, equals: "user-a" },
    });
  });

  it("VERIFIED_USER sees only their own data with explicit null exclusion", () => {
    const where = legacyAdminOnlyWhere(verifiedUser);
    expect(where).toEqual({
      ownerUserId: { not: null, equals: "user-v" },
    });
  });

  it("supports custom fieldName", () => {
    const where = legacyAdminOnlyWhere(regularUser, "userId");
    expect(where).toEqual({
      userId: { not: null, equals: "user-a" },
    });
  });

  it("ADMIN with custom fieldName still sees everything", () => {
    const where = legacyAdminOnlyWhere(admin, "userId");
    expect(where).toEqual({});
  });

  it("explicitly excludes null-owner data (defense-in-depth)", () => {
    const where = legacyAdminOnlyWhere(regularUser);
    const fieldFilter = (where as Record<string, unknown>).ownerUserId as Record<string, unknown>;
    expect(fieldFilter.not).toBe(null);
    expect(fieldFilter.equals).toBe("user-a");
  });
});

describe("ownedResourceWhere vs ownerScopeWhere — legacy null comparison", () => {
  it("ownerScopeWhere exposes null-owner data to non-admins", () => {
    const where = ownerScopeWhere(regularUser);
    expect(where).toEqual({
      OR: [{ ownerUserId: "user-a" }, { ownerUserId: null }],
    });
  });

  it("ownedResourceWhere does NOT expose null-owner data to non-admins", () => {
    const where = ownedResourceWhere(regularUser);
    expect(where).toEqual({ ownerUserId: "user-a" });
    expect(where).not.toHaveProperty("OR");
  });

  it("both return empty filter for ADMIN", () => {
    expect(ownerScopeWhere(admin)).toEqual({});
    expect(ownedResourceWhere(admin)).toEqual({});
  });
});
