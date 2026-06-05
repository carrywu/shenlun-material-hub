import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CollectDialog } from "../CollectDialog";

// Mock fetch
const mockFetch = vi.fn();
const originalFetch = global.fetch;

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "src-1",
    name: "测试来源",
    platform: "website",
    isEnabled: true,
    priority: "P1",
    lastCollectedAt: null,
    ...overrides,
  };
}

describe("CollectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("打开 dialog 时应该加载来源列表", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sources")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [makeSource({ id: "src-1", name: "网站A" }), makeSource({ id: "src-2", name: "微信B", platform: "wechat" })] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("网站A")).toBeInTheDocument();
    });
    expect(screen.getByText("微信B")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith("/api/sources?pageSize=100&isEnabled=true");
  }, 10000);

  it("没有来源时应该显示空状态", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("没有已启用的来源")).toBeInTheDocument();
    });
  });

  it("应该能选择来源并完成采集流程", async () => {
    const sources = [makeSource({ id: "src-1", name: "网站A" })];

    let resolveCollect: (v: unknown) => void;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sources")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: sources }) });
      }
      return new Promise((resolve) => { resolveCollect = resolve; });
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => { expect(screen.getByText("网站A")).toBeInTheDocument(); });

    // Select source
    fireEvent.click(screen.getByRole("checkbox"));
    // Click collect button (the one with Play icon, not the dialog title)
    const buttons = screen.getAllByRole("button", { name: /开始采集/ });
    fireEvent.click(buttons[buttons.length - 1]);

    // Should show collecting progress
    await waitFor(() => { expect(screen.getByText(/正在采集/)).toBeInTheDocument(); });

    // Resolve collection
    resolveCollect!({
      ok: true,
      json: () => Promise.resolve({ success: true, discoveredCount: 5, importedCount: 3, skippedCount: 2 }),
    });

    // Should show results with success count
    await waitFor(() => {
      expect(screen.getByText("采集完成")).toBeInTheDocument();
    });
    // Check the summary shows imported count
    expect(screen.getByText(/共导入 3 条/)).toBeInTheDocument();
    expect(screen.getByText(/跳过 2 条/)).toBeInTheDocument();
  });

  it("应该展示成功和失败来源的状态", async () => {
    const sources = [
      makeSource({ id: "src-1", name: "成功来源" }),
      makeSource({ id: "src-2", name: "失败来源" }),
    ];

    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sources")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: sources }) });
      }
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, discoveredCount: 5, importedCount: 3, skippedCount: 0 }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "采集超时" }),
      });
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => { expect(screen.getByText("成功来源")).toBeInTheDocument(); });

    // Select all sources via the global "全选" button
    const selectAllBtns = screen.getAllByText("全选");
    fireEvent.click(selectAllBtns[0]);

    // Click collect
    const buttons = screen.getAllByRole("button", { name: /开始采集/ });
    fireEvent.click(buttons[buttons.length - 1]);

    // Wait for results
    await waitFor(() => { expect(screen.getByText("采集完成")).toBeInTheDocument(); });

    // Should show both success and failure in the summary
    expect(screen.getByText(/1 成功/)).toBeInTheDocument();
    expect(screen.getByText(/1 失败/)).toBeInTheDocument();

    // Should show per-source results
    expect(screen.getByText("成功来源")).toBeInTheDocument();
    expect(screen.getByText("失败来源")).toBeInTheDocument();
    expect(screen.getByText("采集超时")).toBeInTheDocument();
  });

  it("采集按钮在未选择来源时应该 disabled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [makeSource()] }),
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => { expect(screen.getByText("测试来源")).toBeInTheDocument(); });

    const buttons = screen.getAllByRole("button", { name: /开始采集/ });
    const collectBtn = buttons[buttons.length - 1];
    expect(collectBtn).toBeDisabled();
  });

  it("采集按钮在采集中应该 disabled", async () => {
    let resolveCollect: (v: unknown) => void;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sources")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [makeSource()] }) });
      }
      return new Promise((resolve) => { resolveCollect = resolve; });
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => { expect(screen.getByText("测试来源")).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole("checkbox"));
    const buttons = screen.getAllByRole("button", { name: /开始采集/ });
    fireEvent.click(buttons[buttons.length - 1]);

    // Button should show collecting state and be disabled
    await waitFor(() => {
      const disabledBtn = screen.getByRole("button", { name: /采集中/ });
      expect(disabledBtn).toBeDisabled();
    });

    resolveCollect!({
      ok: true,
      json: () => Promise.resolve({ success: true, discoveredCount: 0, importedCount: 0, skippedCount: 0 }),
    });
  });

  it("应该展示跳过数量", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sources")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [makeSource()] }) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, discoveredCount: 10, importedCount: 3, skippedCount: 7 }),
      });
    });

    render(<CollectDialog open={true} onOpenChange={() => {}} />);

    await waitFor(() => { expect(screen.getByText("测试来源")).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole("checkbox"));
    const buttons = screen.getAllByRole("button", { name: /开始采集/ });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/跳过 7 条/)).toBeInTheDocument();
    });
  });
});
