import { describe, expect, it } from "vitest";
import { contentVisibilityWhere } from "@/lib/data-isolation";

describe("contentVisibilityWhere — adminReviewStatus (P3)", () => {
  it("ADMIN 返回空对象（不加 adminReviewStatus 过滤）", () => {
    const admin = { id: "a", role: "ADMIN", username: "a", status: "ACTIVE" };
    const where = contentVisibilityWhere(admin as never);
    expect(where).toEqual({});
  });

  it("VERIFIED_USER 注入 adminReviewStatus = approved", () => {
    const vu = { id: "v", role: "VERIFIED_USER", username: "v", status: "ACTIVE" };
    const where = contentVisibilityWhere(vu as never);
    expect(where.adminReviewStatus).toBe("approved");
  });

  it("USER 注入 adminReviewStatus = approved", () => {
    const u = { id: "u", role: "USER", username: "u", status: "ACTIVE" };
    const where = contentVisibilityWhere(u as never);
    expect(where.adminReviewStatus).toBe("approved");
  });

  it("非 ADMIN 同时保留原有 OR（public/own/legacy）+ adminReviewStatus", () => {
    const vu = { id: "v", role: "VERIFIED_USER", username: "v", status: "ACTIVE" };
    const where = contentVisibilityWhere(vu as never);
    expect(where.adminReviewStatus).toBe("approved");
    expect(Array.isArray(where.OR)).toBe(true);
  });
});
