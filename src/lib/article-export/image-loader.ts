// Image handling for export.
//
// PDF path: the printable view renders real <img> tags; before triggering the
// browser print we wait for each image to settle (loaded / errored / timeout)
// via waitForImages(). This is browser-side DOM observation and is exercised
// by Playwright, not unit tests.
//
// Word path: docx needs the image bytes inline (ImageRun). fetchImageBytes()
// downloads a single image as ArrayBuffer with a timeout; shouldDowngradeImage()
// decides when to fall back to a text placeholder so one bad image never aborts
// the whole document.
//
// Limits are deliberately conservative for a 2-core shared host (see handoff).
// See development-prompt.md §七.

/** Max bytes for a single embedded image (3 MB). */
export const MAX_SINGLE_IMAGE_BYTES = 3 * 1024 * 1024;
/** Max cumulative bytes for all embedded images in one document (15 MB). */
export const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;
/** Per-image fetch timeout (ms). */
export const IMAGE_FETCH_TIMEOUT_MS = 8000;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}

/**
 * Decide whether an image should be downgraded to a text placeholder.
 * True when the image exceeds the per-image cap OR would blow the cumulative
 * total budget (alreadyUsed = bytes already embedded from prior images).
 */
export function shouldDowngradeImage(
  bytes: number,
  alreadyUsed: number
): boolean {
  if (bytes > MAX_SINGLE_IMAGE_BYTES) return true;
  if (alreadyUsed + bytes > MAX_TOTAL_IMAGE_BYTES) return true;
  return false;
}

export interface FetchedImage {
  bytes: ArrayBuffer;
  contentType: string;
}

/**
 * Fetch a single image as bytes with a timeout. Throws on any failure
 * (network error, non-2xx, timeout) so the caller can fall back to a placeholder.
 */
export async function fetchImageBytes(url: string): Promise<FetchedImage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`image fetch failed: ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const bytes = await res.arrayBuffer();
    return { bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wait for every <img> inside `container` to settle (loaded, errored, or
 * timed out) so the print snapshot captures a stable state. Replaces errored
 * images with a "[图片加载失败]" placeholder text node. Used by the PDF path.
 */
export async function waitForImages(
  container: HTMLElement,
  timeoutMs = IMAGE_FETCH_TIMEOUT_MS
): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  if (imgs.length === 0) return;

  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          img.addEventListener("load", finish, { once: true });
          img.addEventListener("error", finish, { once: true });
          // Always resolve after the timeout; do not block export forever.
          setTimeout(finish, timeoutMs);
        })
    )
  );
}
