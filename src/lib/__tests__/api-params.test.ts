import { describe, expect, it } from "vitest";
import { parsePaginationParams, parsePositiveIntParam } from "../api-params";

describe("api params helpers", () => {
  it("falls back for null, empty, malformed, zero, and negative values", () => {
    expect(parsePositiveIntParam(null, 20)).toBe(20);
    expect(parsePositiveIntParam("", 20)).toBe(20);
    expect(parsePositiveIntParam("abc", 20)).toBe(20);
    expect(parsePositiveIntParam("0", 20)).toBe(20);
    expect(parsePositiveIntParam("-1", 20)).toBe(20);
  });

  it("parses positive integers and caps large values", () => {
    expect(parsePositiveIntParam("3", 20)).toBe(3);
    expect(parsePositiveIntParam("999", 20, 100)).toBe(100);
    expect(parsePositiveIntParam("12px", 20, 100)).toBe(12);
  });

  it("parses pagination params with safe defaults", () => {
    const params = new URLSearchParams("page=abc&pageSize=999");

    expect(parsePaginationParams(params)).toEqual({ page: 1, pageSize: 100 });
  });

  it("supports custom pagination defaults", () => {
    const params = new URLSearchParams("page=&pageSize=bad");

    expect(parsePaginationParams(params, { defaultPage: 2, defaultPageSize: 10, maxPageSize: 50 })).toEqual({
      page: 2,
      pageSize: 10,
    });
  });
});
