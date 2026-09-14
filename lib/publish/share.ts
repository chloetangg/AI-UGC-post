import {
  REDNOTE_PUBLISH_DEEP_LINK,
  buildPublishFilesLenient,
  buildPublishText,
  canShareFiles,
  collectRednoteDownloads,
  copyPublishText,
  downloadRednoteImage,
  isMobileDevice,
  isUserCancellation,
  saveRednoteImages,
  type RednotePublishPackage,
} from "@/lib/rednote-publish";
import type { PublishRuntime, SharePostResult } from "@/lib/publish/types";

function canShareData(data: ShareData) {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

export function getPublishRuntime(): PublishRuntime {
  if (typeof navigator === "undefined" || !isMobileDevice()) return "desktop";
  if (/Android/i.test(navigator.userAgent || "")) return "android";
  return "ios";
}

/**
 * Convert POST images (https, blob:, or data:) into Files and open the OS share sheet.
 * Never calls OpenAI, never uploads images, never picks a destination app.
 */
export async function sharePost(pkg: RednotePublishPackage): Promise<SharePostResult> {
  const text = buildPublishText(pkg);
  const title = pkg.title;
  const copied = await copyPublishText(text);

  if (getPublishRuntime() === "desktop") {
    return { outcome: "desktop", copied, filesPartial: false };
  }

  const { files, items, failed } = await buildPublishFilesLenient(pkg);
  const filesPartial = failed > 0 || (items.length > 0 && files.length === 0);

  if (canShareFiles(files)) {
    const withText: ShareData = { files, text, title };
    const filesOnly: ShareData = { files };
    const payload = canShareData(withText) ? withText : canShareData(filesOnly) ? filesOnly : null;
    if (payload) {
      try {
        await navigator.share(payload);
        return { outcome: "shared", copied, filesPartial };
      } catch (error) {
        if (isUserCancellation(error)) {
          return { outcome: "cancelled", copied, filesPartial };
        }
        console.error("Web Share failed", error);
      }
    }
  }

  return fallbackPublish(copied, filesPartial);
}

export async function fallbackPublish(copied = false, filesPartial = false): Promise<SharePostResult> {
  return { outcome: "fallback", copied, filesPartial };
}

export async function downloadGeneratedImage(pkg: RednotePublishPackage) {
  const items = collectRednoteDownloads(pkg);
  if (items.length === 0) return false;
  if (isMobileDevice()) {
    const result = await saveRednoteImages(pkg);
    return result === "shared" || result === "downloaded" || result === "long-press";
  }
  let any = false;
  for (const [index, item] of items.entries()) {
    const ok = await downloadRednoteImage(item.url, item.fileName);
    if (ok) any = true;
    if (index < items.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 280));
  }
  return any;
}

export { REDNOTE_PUBLISH_DEEP_LINK };
