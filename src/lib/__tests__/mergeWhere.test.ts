import { describe, it, expect } from "vitest";
import { mergeWhere } from "@/lib/data-isolation";

describe("mergeWhere", () => {
  it("returns base when filter is empty", () => {
    const base = { sourceId: "abc" };
    const result = mergeWhere(base, {});
    expect(result).toEqual({ sourceId: "abc" });
  });

  it("returns filter when base is empty", () => {
    const filter = { OR: [{ ownerUserId: "user-1" }, { ownerUserId: null }] };
    const result = mergeWhere({}, filter);
    expect(result).toEqual(filter);
  });

  it("returns base as-is when both are empty", () => {
    const result = mergeWhere({}, {});
    expect(result).toEqual({});
  });

  it("spreads scalar keys when no OR collision", () => {
    const base = { sourceId: "abc", platform: "website" };
    const filter = { ownerUserId: "user-1" };
    const result = mergeWhere(base, filter);
    expect(result).toEqual({ sourceId: "abc", platform: "website", ownerUserId: "user-1" });
  });

  it("preserves base OR when filter has no OR", () => {
    const base = { OR: [{ title: { contains: "test" } }] };
    const filter = { sourceId: "abc" };
    const result = mergeWhere(base, filter);
    expect(result).toEqual({ OR: [{ title: { contains: "test" } }], sourceId: "abc" });
  });

  it("preserves filter OR when base has no OR", () => {
    const base = { sourceId: "abc" };
    const filter = { OR: [{ ownerUserId: "user-1" }, { ownerUserId: null }] };
    const result = mergeWhere(base, filter);
    expect(result).toEqual({ sourceId: "abc", OR: [{ ownerUserId: "user-1" }, { ownerUserId: null }] });
  });

  it("wraps both ORs in AND when collision occurs", () => {
    const base = {
      OR: [
        { title: { contains: "keyword" } },
        { excerpt: { contains: "keyword" } },
      ],
    };
    const filter = {
      OR: [
        { ownerUserId: "user-1" },
        { ownerUserId: null },
      ],
    };
    const result = mergeWhere(base, filter);

    // Should NOT have a top-level OR
    expect(result).not.toHaveProperty("OR");

    // Should have AND with both ORs
    expect(result).toHaveProperty("AND");
    const and = (result as { AND: unknown[] }).AND;
    expect(and).toHaveLength(2);
    expect(and[0]).toEqual({ OR: base.OR });
    expect(and[1]).toEqual({ OR: filter.OR });
  });

  it("merges scalar keys alongside AND-wrapped ORs", () => {
    const base = {
      sourceId: "abc",
      OR: [{ title: { contains: "keyword" } }],
    };
    const filter = {
      platform: "website",
      OR: [{ ownerUserId: "user-1" }],
    };
    const result = mergeWhere(base, filter);

    expect(result).toHaveProperty("sourceId", "abc");
    expect(result).toHaveProperty("platform", "website");
    expect(result).not.toHaveProperty("OR");

    const and = (result as { AND: unknown[] }).AND;
    expect(and).toHaveLength(2);
  });

  it("preserves existing AND from base when OR collision occurs", () => {
    const base = {
      AND: [{ sourceSnapshot: { contains: "tag1" } }],
      OR: [{ title: { contains: "keyword" } }],
    };
    const filter = {
      OR: [{ ownerUserId: "user-1" }],
    };
    const result = mergeWhere(base, filter);

    const and = (result as { AND: unknown[] }).AND;
    // Should have: base.AND item, base OR, filter OR
    expect(and).toHaveLength(3);
    expect(and[0]).toEqual({ sourceSnapshot: { contains: "tag1" } });
    expect(and[1]).toEqual({ OR: [{ title: { contains: "keyword" } }] });
    expect(and[2]).toEqual({ OR: [{ ownerUserId: "user-1" }] });
  });

  it("preserves existing AND from filter when OR collision occurs", () => {
    const base = {
      OR: [{ title: { contains: "keyword" } }],
    };
    const filter = {
      AND: [{ someField: "value" }],
      OR: [{ ownerUserId: "user-1" }],
    };
    const result = mergeWhere(base, filter);

    const and = (result as { AND: unknown[] }).AND;
    expect(and).toHaveLength(3);
    expect(and[0]).toEqual({ OR: [{ title: { contains: "keyword" } }] });
    expect(and[1]).toEqual({ OR: [{ ownerUserId: "user-1" }] });
    expect(and[2]).toEqual({ someField: "value" });
  });

  it("real-world search + visibility scenario", () => {
    // Simulates content-items route: search OR + visibility filter OR
    const base = {
      sourceId: "src-1",
      OR: [
        { title: { contains: "改革" } },
        { excerpt: { contains: "改革" } },
      ],
    };
    const filter = {
      OR: [
        { visibility: "public" },
        { ownerUserId: "user-1" },
        { ownerUserId: null },
      ],
    };
    const result = mergeWhere(base, filter);

    expect(result).toHaveProperty("sourceId", "src-1");
    expect(result).not.toHaveProperty("OR");

    const and = (result as { AND: unknown[] }).AND;
    expect(and).toHaveLength(2);

    // Verify both ORs are preserved
    const orConditions = and.map((a: unknown) => a as Record<string, unknown>);
    expect(orConditions[0]).toEqual({ OR: base.OR });
    expect(orConditions[1]).toEqual({ OR: filter.OR });
  });
});
