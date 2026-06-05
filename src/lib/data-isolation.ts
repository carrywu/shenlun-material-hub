// Data isolation helpers for multi-user query filtering

import type { AuthUser } from "./auth";

/**
 * Build a Prisma where clause for content visibility filtering.
 * - ADMIN sees everything
 * - Other users see public content + their own private content
 */
export function contentVisibilityWhere(user: AuthUser) {
  if (user.role === "ADMIN") {
    return {}; // Admin sees all
  }
  return {
    OR: [
      { visibility: "public" },
      { ownerUserId: user.id },
      { ownerUserId: null }, // Legacy public data without owner
    ],
  };
}

/**
 * Build a Prisma where clause for owner-scoped data (MaterialCard, SyncRecord, etc.)
 * - ADMIN sees everything
 * - Other users see their own data + data with no owner (legacy)
 */
export function ownerScopeWhere(user: AuthUser, fieldName = "ownerUserId") {
  if (user.role === "ADMIN") {
    return {};
  }
  return {
    OR: [
      { [fieldName]: user.id },
      { [fieldName]: null },
    ],
  };
}

/**
 * Check if a user can access a specific resource by owner.
 * - ADMIN can access anything
 * - Owner can access their own
 * - Public (null owner) can be accessed by anyone authenticated
 */
export function canAccessResource(
  user: AuthUser,
  resourceOwnerId: string | null,
  visibility?: string
): boolean {
  if (user.role === "ADMIN") return true;
  if (resourceOwnerId === null) return true; // Legacy public data
  if (resourceOwnerId === user.id) return true;
  if (visibility === "public") return true;
  return false;
}

/**
 * Check if a user can modify/delete a specific resource.
 * - ADMIN can modify anything
 * - Only the owner can modify their own
 */
export function canModifyResource(
  user: AuthUser,
  resourceOwnerId: string | null
): boolean {
  if (user.role === "ADMIN") return true;
  if (resourceOwnerId === user.id) return true;
  return false;
}
