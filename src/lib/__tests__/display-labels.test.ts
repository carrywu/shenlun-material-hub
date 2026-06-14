import { describe, expect, it } from "vitest";

import {
  getAiDecisionLabel,
  getAiAssessmentSourceLabel,
  getSafeDisplayLabel,
  getSyncStatusLabel,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_OPTIONS,
  translateTag,
  parseTopicTags,
  CONTENT_TYPE_LABELS,
  TRUST_LEVEL_LABELS,
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

describe("AI decision labels", () => {
  it("maps AI decision machine values to Chinese labels", () => {
    expect(getAiDecisionLabel("accept")).toBe("已通过");
    expect(getAiDecisionLabel("accepted")).toBe("已通过");
    expect(getAiDecisionLabel("reject")).toBe("已拒绝");
    expect(getAiDecisionLabel("rejected")).toBe("已拒绝");
    expect(getAiDecisionLabel("pending")).toBe("待评估");
    expect(getAiDecisionLabel(null)).toBe("尚未评估");
    expect(getAiDecisionLabel(undefined)).toBe("尚未评估");
    expect(getAiDecisionLabel("unexpected_internal_code")).toBe("未知");
  });
});

describe("AI assessment source labels", () => {
  it("maps AI assessment provenance to Chinese labels", () => {
    expect(getAiAssessmentSourceLabel("ai-runtime")).toBe("真实 AI 评估");
    expect(getAiAssessmentSourceLabel("database")).toBe("数据库记录");
    expect(getAiAssessmentSourceLabel("seed")).toBe("种子数据");
    expect(getAiAssessmentSourceLabel("mock")).toBe("模拟数据");
    expect(getAiAssessmentSourceLabel(null)).toBe("历史数据库记录 / 来源未知");
    expect(getAiAssessmentSourceLabel("unexpected_internal_code")).toBe("来源未知");
  });
});

describe("sync status labels", () => {
  it("maps sync status machine values to Chinese labels", () => {
    expect(getSyncStatusLabel("success")).toBe("成功");
    expect(getSyncStatusLabel("failed")).toBe("失败");
    expect(getSyncStatusLabel("skipped")).toBe("已跳过");
    expect(getSyncStatusLabel("pending")).toBe("待同步");
    expect(getSyncStatusLabel(null)).toBe("未知");
    expect(getSyncStatusLabel("unexpected_internal_code")).toBe("未知");
  });
});

describe("translateTag", () => {
  it("translates known contentType tags", () => {
    // official_primary exists in both TRUST_LEVEL_LABELS ("官方一手") and CONTENT_TYPE_LABELS ("核心官媒")
    // translateTag searches TRUST_LEVEL first, so it returns "官方一手"
    expect(translateTag("official_primary")).toBe("官方一手");
    expect(translateTag("policy_analysis")).toBe("政策解读");
    expect(translateTag("local_official")).toBe("地方政务");
  });

  it("translates known trustLevel tags", () => {
    expect(translateTag("official_repost")).toBe("官方转载");
    expect(translateTag("unverified")).toBe("未验证");
  });

  it("returns original value for unknown tags", () => {
    expect(translateTag("some_future_tag")).toBe("some_future_tag");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(translateTag(null)).toBe("");
    expect(translateTag(undefined)).toBe("");
    expect(translateTag("")).toBe("");
  });
});

describe("parseTopicTags", () => {
  it("parses valid JSON array of strings", () => {
    expect(parseTopicTags('["政策","经济"]')).toEqual(["政策", "经济"]);
  });

  it("returns empty array for null/undefined/empty", () => {
    expect(parseTopicTags(null)).toEqual([]);
    expect(parseTopicTags(undefined)).toEqual([]);
    expect(parseTopicTags("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseTopicTags("not json")).toEqual([]);
    expect(parseTopicTags("{bad")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseTopicTags('"hello"')).toEqual([]);
    expect(parseTopicTags("42")).toEqual([]);
    expect(parseTopicTags('{"key":"val"}')).toEqual([]);
  });

  it("filters out non-string elements", () => {
    expect(parseTopicTags('["a", 123, true, "b"]')).toEqual(["a", "b"]);
  });

  it("filters out empty strings and deduplicates", () => {
    expect(parseTopicTags('["a", "", "a", "b"]')).toEqual(["a", "b"]);
  });
});
