// Trigger a browser download for a Blob using file-saver.
// Used by the Word (.docx) export path. PDF uses the browser print window.

import { saveAs } from "file-saver";

export function downloadBlob(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}
