import {
  REDNOTE_PUBLISH_DEEP_LINK,
  buildPublishFilesLenient,
  canShareFiles,
  collectRednoteDownloads,
  downloadRednoteImage,
  downloadRednoteImages,
  isMobileDevice,
  isUserCancellation,
  saveRednoteImages,
  type RednoteDownloadItem,
  type RednotePublishPackage,
} from "@/lib/rednote-publish";
import type { PublishRuntime, SharePostResult } from "@/lib/publish/types";

export function getPublishRuntime(): PublishRuntime {
  if (typeof navigator === "undefined" || !isMobileDevice()) return "desktop";
  if (/Android/i.test(navigator.userAgent || "")) return "android";
  return "ios";
}

/**
 * Share images only through the OS share sheet.
 * Caption/title stay in the page copy button — never passed to navigator.share.
 */
export async function sharePost(pkg: RednotePublishPackage): Promise<SharePostResult> {
  if (getPublishRuntime() === "desktop") {
    return { outcome: "desktop", copied: false, filesPartial: false };
  }

  const { files, items, failed } = await buildPublishFilesLenient(pkg);
  const filesPartial = failed > 0 || (items.length > 0 && files.length === 0);

  if (canShareFiles(files)) {
    try {
      await navigator.share({ files });
      return { outcome: "shared", copied: false, filesPartial };
    } catch (error) {
      if (isUserCancellation(error)) {
        return { outcome: "cancelled", copied: false, filesPartial };
      }
      console.error("Web Share failed", error);
    }
  }

  return fallbackPublish(false, filesPartial);
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

/** Sequential downloads only — never opens the system share sheet. */
export async function saveImagesWithoutShare(pkg: RednotePublishPackage) {
  return downloadRednoteImages(pkg);
}

export async function saveOneImageWithoutShare(item: RednoteDownloadItem) {
  return downloadRednoteImage(item.url, item.fileName);
}

export { REDNOTE_PUBLISH_DEEP_LINK };
