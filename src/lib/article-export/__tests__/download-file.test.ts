import { describe, expect, it, vi, afterEach } from "vitest";

// Mock file-saver so we assert OUR wrapper delegates correctly (its real contract),
// rather than poking at saveAs internals.
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

import { saveAs } from "file-saver";
import { downloadBlob } from "../download-file";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to file-saver saveAs with the blob and filename", () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    downloadBlob(blob, "申论文章_无批注.docx");
    expect(saveAs).toHaveBeenCalledWith(blob, "申论文章_无批注.docx");
  });
});
