import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/lib/auth-context";
import { BatchSyncToIma } from "../SyncToIma";

const admin = {
  id: "admin-1",
  username: "admin",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
};

function renderAsAdmin(cardIds: string[]) {
  return render(
    <AuthProvider user={admin}>
      <BatchSyncToIma cardIds={cardIds} />
    </AuthProvider>
  );
}

describe("BatchSyncToIma", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("未选择素材卡时点击批量同步显示提示", async () => {
    renderAsAdmin([]);

    fireEvent.click(screen.getByRole("button", { name: "批量同步" }));

    expect(await screen.findByText("请先选择要同步的素材卡")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("批量同步部分失败时展示成功数、失败数和失败原因", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        total: 3,
        success: 2,
        failed: 1,
        skipped: 0,
        items: [
          { materialCardId: "card-1", status: "success", imaDocumentId: "doc-1" },
          { materialCardId: "card-2", status: "success", imaDocumentId: "doc-2" },
          { materialCardId: "card-3", status: "failed", errorMessage: "IMA 鉴权失败" },
        ],
      }),
    } as Response);

    renderAsAdmin(["card-1", "card-2", "card-3"]);

    fireEvent.click(screen.getByRole("button", { name: "批量同步到 IMA (3)" }));

    await waitFor(() => {
      expect(screen.getByText("成功 2")).toBeInTheDocument();
    });
    expect(screen.getByText("失败 1")).toBeInTheDocument();
    expect(screen.getByText(/失败原因：.*IMA 鉴权失败/)).toBeInTheDocument();
  });
});
