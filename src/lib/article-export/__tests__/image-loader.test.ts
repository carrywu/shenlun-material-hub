import { describe, expect, it } from "vitest";
import {
  isAllowedImageType,
  shouldDowngradeImage,
  MAX_SINGLE_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
} from "../image-loader";

describe("image-loader limits", () => {
  it("allows common image content types", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/gif")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
  });

  it("rejects non-image content types", () => {
    expect(isAllowedImageType("text/html")).toBe(false);
    expect(isAllowedImageType("application/json")).toBe(false);
    expect(isAllowedImageType("")).toBe(false);
  });

  it("downgrades a single image exceeding the per-image limit", () => {
    expect(shouldDowngradeImage(MAX_SINGLE_IMAGE_BYTES + 1, 0)).toBe(true);
  });

  it("keeps a single image within the per-image limit", () => {
    expect(shouldDowngradeImage(MAX_SINGLE_IMAGE_BYTES, 0)).toBe(false);
    expect(shouldDowngradeImage(1024, 0)).toBe(false);
  });

  it("downgrades when cumulative bytes already exceed the total limit", () => {
    expect(
      shouldDowngradeImage(100, MAX_TOTAL_IMAGE_BYTES)
    ).toBe(true);
  });

  it("keeps an image when it fits both per-image and remaining total budget", () => {
    expect(shouldDowngradeImage(1024, MAX_TOTAL_IMAGE_BYTES - 2048)).toBe(false);
  });
});
