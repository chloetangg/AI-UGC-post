import { ensureRequiredHashtags, stripAllHashtagsFromCaption } from "@/lib/hashtags";

/** Official Rednote / Xiaohongshu in-app publish entry. No undocumented params. */
export const REDNOTE_PUBLISH_DEEP_LINK = "xhsdiscover://post";

export type PublishStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "copied"
  | "opening-rednote"
  | "fallback"
  | "completed";

export type RednotePublishPhoto = {
  index: number;
  url: string;
  fileName?: string;
  isCover: boolean;
};

export type RednotePublishPackage = {
  title: string;
  caption: string;
  hashtags: string[];
  fullText: string;
  coverImageUrl: string;
  selectedPhotoIndex: number;
  photos: RednotePublishPhoto[];
};

export type RednotePublishSource = {
  titles: readonly string[];
  selectedTitleIndex: number;
  caption: string;
  hashtags: string[];
  coverImageUrl: string | null;
  selectedPhotoIndex: number;
  coverPhotoIndexes?: number[];
  photos: Array<{ previewUrl: string; name?: string }>;
};

export type RednoteDownloadItem = {
  key: string;
  url: string;
  fileName: string;
  kind: "cover" | "photo";
  labelIndex: number;
};

export type OpenRednoteResult = "opened" | "failed";

function joinBlocks(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function photoFileName(name: string | undefined, index: number) {
  const raw = name?.trim() || `photo-${index + 1}.jpg`;
  return raw.replace(/[^\w.\u4e00-\u9fff-]+/g, "-");
}

/** Caption + hashtags only. Title stays out of this string. */
export function formatRednoteFullText(caption: string, hashtags: string[]) {
  const tags = hashtags.filter(Boolean).join(" ");
  return joinBlocks([caption, tags]);
}

/** Paste-ready block: title, caption (with Location & Time), hashtags. */
export function formatRednotePasteText(pkg: Pick<RednotePublishPackage, "title" | "caption" | "hashtags">) {
  return joinBlocks([pkg.title, pkg.caption, pkg.hashtags.filter(Boolean).join(" ")]);
}

/**
 * Normalize the POST-page draft for publishing.
 * Local only — no OpenAI, no Cover Composer.
 */
export function prepareRednotePublishPackage(source: RednotePublishSource): RednotePublishPackage {
  const title = source.titles[source.selectedTitleIndex] ?? source.titles[0] ?? "";
  const caption = stripAllHashtagsFromCaption(source.caption);
  const hashtags = [...ensureRequiredHashtags(source.hashtags)];
  const selectedPhotoIndex = Number.isInteger(source.selectedPhotoIndex) ? source.selectedPhotoIndex : 0;
  const coverIndexSet = new Set(
    (source.coverPhotoIndexes?.length ? source.coverPhotoIndexes : [selectedPhotoIndex]).filter(
      (index) => Number.isInteger(index) && index >= 0,
    ),
  );
  const photos: RednotePublishPhoto[] = source.photos.map((photo, index) => ({
    index,
    url: photo.previewUrl,
    fileName: photoFileName(photo.name, index),
    isCover: coverIndexSet.has(index),
  }));

  return {
    title,
    caption,
    hashtags,
    fullText: formatRednoteFullText(caption, hashtags),
    coverImageUrl: source.coverImageUrl ?? "",
    selectedPhotoIndex,
    photos,
  };
}

export function collectRednoteDownloads(pkg: RednotePublishPackage): RednoteDownloadItem[] {
  const items: RednoteDownloadItem[] = [];
  if (pkg.coverImageUrl) {
    items.push({
      key: "cover",
      url: pkg.coverImageUrl,
      fileName: "baan-ying-cover.png",
      kind: "cover",
      labelIndex: 1,
    });
  }
  for (const photo of pkg.photos) {
    if (pkg.coverImageUrl && photo.isCover) continue;
    items.push({
      key: `photo-${photo.index}`,
      url: photo.url,
      fileName: photo.fileName || `baan-ying-photo-${photo.index + 1}.jpg`,
      kind: "photo",
      labelIndex: items.length + 1,
    });
  }
  return items;
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh|Mac OS X/i.test(ua)) return true;
  return false;
}

async function copyWithFallback(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function copyRednoteText(text: string) {
  if (typeof document === "undefined") return false;
  return copyWithFallback(text);
}

export type SaveImagesResult = "shared" | "downloaded" | "long-press" | "cancelled" | "failed";

function imageMime(fileName: string, blobType: string) {
  if (blobType.startsWith("image/")) return blobType;
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  return "image/jpeg";
}

function imageFileName(fileName: string, mime: string) {
  if (/\.(png|jpe?g|webp)$/i.test(fileName)) return fileName;
  if (mime === "image/png") return `${fileName}.png`;
  if (mime === "image/webp") return `${fileName}.webp`;
  return `${fileName}.jpg`;
}

async function urlToBlob(url: string) {
  const response = await fetch(url);
  return response.blob();
}

async function urlToObjectUrl(url: string) {
  const blob = await urlToBlob(url);
  return URL.createObjectURL(blob);
}

async function itemToImageFile(item: RednoteDownloadItem) {
  const blob = await urlToBlob(item.url);
  const mime = imageMime(item.fileName, blob.type);
  const named = imageFileName(item.fileName, mime);
  return new File([blob], named, { type: mime });
}

export function canShareImagesToPhotos() {
  if (typeof navigator === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof navigator.share === "function";
}

async function shareImageFiles(files: File[]) {
  if (files.length === 0 || typeof navigator.share !== "function") return "failed" as const;
  try {
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files })) {
      return "failed" as const;
    }
    await navigator.share({ files, title: files.length > 1 ? "Baan Ying photos" : files[0]?.name });
    return "shared" as const;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
    return "failed" as const;
  }
}

/** Prefer the system share sheet so the customer can save into Photos. */
export async function saveRednoteImage(url: string, fileName: string): Promise<SaveImagesResult> {
  const item: RednoteDownloadItem = {
    key: "one",
    url,
    fileName,
    kind: "photo",
    labelIndex: 1,
  };
  if (canShareImagesToPhotos() && isMobileDevice()) {
    try {
      const file = await itemToImageFile(item);
      const shared = await shareImageFiles([file]);
      if (shared === "shared" || shared === "cancelled") return shared;
    } catch {
      /* fall through */
    }
  }
  if (isMobileDevice() && !canShareImagesToPhotos()) return "long-press";
  const ok = await downloadRednoteImage(url, fileName);
  return ok ? "downloaded" : "failed";
}

export async function saveRednoteImages(pkg: RednotePublishPackage): Promise<SaveImagesResult> {
  const items = collectRednoteDownloads(pkg);
  if (items.length === 0) return "failed";
  if (canShareImagesToPhotos() && isMobileDevice()) {
    try {
      const files: File[] = [];
      for (const item of items) files.push(await itemToImageFile(item));
      const shared = await shareImageFiles(files);
      if (shared === "shared" || shared === "cancelled") return shared;
      if (files[0]) {
        const one = await shareImageFiles([files[0]]);
        if (one === "shared" || one === "cancelled") return one;
      }
    } catch {
      /* fall through */
    }
  }
  if (isMobileDevice() && !canShareImagesToPhotos()) return "long-press";
  const results = await downloadRednoteImages(pkg);
  return results.some((item) => item.ok) ? "downloaded" : "failed";
}

export async function downloadRednoteImage(url: string, fileName: string) {
  if (typeof document === "undefined") return false;
  let objectUrl = "";
  try {
    objectUrl = await urlToObjectUrl(url);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch {
      return false;
    }
  } finally {
    if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    }
  }
}

export async function downloadRednoteImages(pkg: RednotePublishPackage) {
  const items = collectRednoteDownloads(pkg);
  const results: Array<{ fileName: string; ok: boolean }> = [];
  for (const [index, item] of items.entries()) {
    const ok = await downloadRednoteImage(item.url, item.fileName);
    results.push({ fileName: item.fileName, ok });
    if (index < items.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 280));
    }
  }
  return results;
}

/**
 * Open the official Rednote publish screen.
 * Content is not passed through the URL — injection stays a separate future hook.
 */
export function openRednotePublish(): Promise<OpenRednoteResult> {
  if (typeof window === "undefined") return Promise.resolve("failed");

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: OpenRednoteResult) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
      window.removeEventListener("blur", onBlur);
      resolve(result);
    };

    const onHidden = () => {
      if (document.hidden || document.visibilityState === "hidden") finish("opened");
    };
    const onBlur = () => finish("opened");

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    window.addEventListener("blur", onBlur);

    window.location.href = REDNOTE_PUBLISH_DEEP_LINK;

    window.setTimeout(() => {
      if (document.hidden || document.visibilityState === "hidden") {
        finish("opened");
        return;
      }
      finish("failed");
    }, 1600);
  });
}
