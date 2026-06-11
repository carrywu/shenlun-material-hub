import { describe, expect, it } from "vitest";
import {
  contentVisibilityWhere,
  ownerScopeWhere,
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

const otherUser: AuthUser = {
  id: "user-b",
  username: "userB",
  role: "USER",
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
