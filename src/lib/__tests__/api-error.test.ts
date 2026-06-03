import { describe, expect, it } from "vitest";
import { formatApiErrorMessage } from "../api-error";

describe("formatApiErrorMessage", () => {
  it("formats structured AI errors with safe diagnostics", () => {
    expect(formatApiErrorMessage({
      error: "AI_API_CALL_FAILED",
      message: "AI 请求失败",
      status: 401,
      source: "db",
      baseURL: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      keySuffix: "****1234",
      requestId: "req-1",
    })).toBe("AI 请求失败：status=401，source=db，baseURL=https://api.deepseek.com/v1，model=deepseek-chat，key=****1234。请查看服务端日志 requestId=req-1");
  });
});
