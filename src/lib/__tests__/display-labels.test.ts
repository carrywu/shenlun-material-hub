import { describe, expect, it } from "vitest";

import {
  getSafeDisplayLabel,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_OPTIONS,
} from "../display-labels";

describe("display labels", () => {
  it("does not expose data_fact as a new material type option", () => {
    expect(MATERIAL_TYPE_OPTIONS.map((option) => option.value)).not.toContain("data_fact");
    expect(MATERIAL_TYPE_OPTIONS.map((option) => option.label)).not.toContain("数据事实");
  });

  it("maps historical data_fact material cards to 案例素材", () => {
    expect(getSafeDisplayLabel("data_fact", MATERIAL_TYPE_LABELS)).toBe("案例素材");
    expect(getSafeDisplayLabel("fact_summary", MATERIAL_TYPE_LABELS)).toBe("案例素材");
    expect(getSafeDisplayLabel("data_highlight", MATERIAL_TYPE_LABELS)).toBe("案例素材");
  });

  it("does not fall back to unknown internal values in user display", () => {
    expect(getSafeDisplayLabel("unexpected_internal_code", MATERIAL_TYPE_LABELS)).toBe("未分类");
  });
});
