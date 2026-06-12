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
    adminReviewStatus: "approved", // P3: 非 ADMIN 只看审核通过
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
 *
 * ⚠️ WARNING: This exposes legacy null-owner data to non-admin users.
 * For user-owned resources where legacy null data should NOT be visible to non-admins,
 * use `ownedResourceWhere` instead.
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
 * Build a Prisma where clause for strictly owned resources (MaterialCard, Annotation, SyncRecord, etc.).
 * - ADMIN sees everything
 * - Non-admin sees ONLY their own data (no legacy null-owner data)
 *
 * Use this for user-owned resources where legacy null-owner data should only be
 * visible to admins. This is the recommended replacement for `ownerScopeWhere`
 * in routes that handle user assets (material-cards, sync-records, annotations).
 */
export function ownedResourceWhere(user: AuthUser, fieldName = "ownerUserId") {
  if (user.role === "ADMIN") {
    return {};
  }
  return { [fieldName]: user.id };
}

/**
 * Build a Prisma where clause that excludes legacy null-owner data for non-admins.
 * - ADMIN sees everything (including null-owner)
 * - Non-admin sees only their own data AND explicitly excludes null-owner records
 *
 * Use this when you need to be extra strict: not only should non-admins not see
 * other users' data, but legacy null-owner data must be explicitly filtered out
 * (rather than just not included, as in `ownedResourceWhere`).
 *
 * In practice, `ownedResourceWhere` is usually sufficient since Prisma's
 * `{ [fieldName]: user.id }` already excludes null values. Use this only when
 * you need the explicit `not: null` guard for clarity or defense-in-depth.
 */
export function legacyAdminOnlyWhere(user: AuthUser, fieldName = "ownerUserId") {
  if (user.role === "ADMIN") {
    return {};
  }
  return { [fieldName]: { not: null, equals: user.id } };
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

/**
 * Safely merge two Prisma where clauses, avoiding OR key collisions.
 * When both sides have OR, wraps them in AND to preserve both conditions.
 */
export function mergeWhere(
  base: Record<string, unknown>,
  filter: Record<string, unknown>
): Record<string, unknown> {
  if (!Object.keys(filter).length) return base;
  if (!Object.keys(base).length) return filter;

  const baseOR = base.OR;
  const filterOR = filter.OR;

  if (baseOR && filterOR) {
    // Both have OR — wrap with AND to avoid collision
    const { OR: _b, ...baseRest } = base;
    const { OR: _f, ...filterRest } = filter;
    const merged: Record<string, unknown> = { ...baseRest, ...filterRest };
    const andParts: unknown[] = [];
    if (baseRest.AND) andParts.push(baseRest.AND);
    andParts.push({ OR: baseOR });
    andParts.push({ OR: filterOR });
    if (filterRest.AND) andParts.push(filterRest.AND);
    merged.AND = andParts.flat();
    return merged;
  }

  return { ...base, ...filter };
}
