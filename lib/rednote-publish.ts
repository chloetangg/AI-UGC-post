import { ensureRequiredHashtags, stripAllHashtagsFromCaption } from "@/lib/hashtags";

/** Official Rednote / Xiaohongshu in-app publish entry. No undocumented params. */
export const REDNOTE_PUBLISH_DEEP_LINK = "xhsdiscover://post";

export type PublishStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "copied"
  | "sharing"
  | "shared"
  | "cancelled"
  | "files-partial"
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
  titles: string[];
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

export type ShareToRednoteOutcome = "shared" | "cancelled" | "fallback-opened" | "fallback-failed";

export type ShareToRednoteResult = {
  outcome: ShareToRednoteOutcome;
  filesPartial: boolean;
  copied: boolean;
};

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

function extensionFromName(name: string) {
  const match = name.match(/\.(png|jpe?g|webp)$/i);
  if (!match) return "";
  const ext = match[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

function extensionFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "";
}

export function publishFileName(item: Pick<RednoteDownloadItem, "kind" | "fileName">, arrayIndex: number) {
  const ext = extensionFromName(item.fileName) || (item.kind === "cover" ? "png" : "jpg");
  if (item.kind === "cover") return `rednote-cover.${ext}`;
  return `rednote-photo-${String(arrayIndex + 1).padStart(2, "0")}.${ext}`;
}

/** Caption + hashtags only. Title stays out of this string. */
export function formatRednoteFullText(caption: string, hashtags: string[]) {
  const tags = hashtags.filter(Boolean).join(" ");
  return joinBlocks([caption, tags]);
}

/** Caption (with Location & Time) + hashtags. Title stays in `finalTitle`. */
export function buildRednoteText(pkg: Pick<RednotePublishPackage, "caption" | "hashtags">) {
  return formatRednoteFullText(pkg.caption, pkg.hashtags);
}

/** Existing POST caption + hashtags. Never calls OpenAI. */
export function buildPublishText(pkg: Pick<RednotePublishPackage, "caption" | "hashtags">) {
  return buildRednoteText(pkg);
}

export function preparePublishPackage(source: RednotePublishSource) {
  return prepareRednotePublishPackage(source);
}

export function finalTitle(pkg: Pick<RednotePublishPackage, "title">) {
  return pkg.title;
}

function stripLeadingTitles(caption: string, titles: string[]) {
  let next = caption.trim();
  const blocks = titles.map((title) => title.trim()).filter(Boolean);
  let changed = true;
  while (changed && next) {
    changed = false;
    for (const title of blocks) {
      if (next === title) return "";
      if (next.startsWith(`${title}\n`)) {
        next = next.slice(title.length).replace(/^\s+/, "");
        changed = true;
      }
    }
  }
  return next;
}

/** Xiaohongshu paste: only the selected title + caption + hashtags. */
export function formatXiaohongshuPasteText(
  pkg: Pick<RednotePublishPackage, "title" | "caption" | "hashtags"> & { titles?: string[] },
) {
  const title = pkg.title.trim();
  const caption = stripLeadingTitles(pkg.caption, [title, ...(pkg.titles ?? [])]);
  return joinBlocks([title, caption, pkg.hashtags.filter(Boolean).join(" ")]);
}

/** Paste-ready block: selected title, caption (with Location & Time), hashtags. */
export function formatRednotePasteText(
  pkg: Pick<RednotePublishPackage, "title" | "caption" | "hashtags">,
) {
  return formatXiaohongshuPasteText(pkg);
}

/** Dianping paste: generated caption only. No title, no hashtags. */
export function formatDianpingPasteText(pkg: Pick<RednotePublishPackage, "caption">) {
  return pkg.caption.trim();
}

/**
 * Normalize the POST-page draft for publishing.
 * Local only — no OpenAI, no Cover Composer.
 */
export function prepareRednotePublishPackage(source: RednotePublishSource): RednotePublishPackage {
  const titles = (Array.isArray(source.titles) ? source.titles : []).map((title) => title.trim());
  const selected = titles[source.selectedTitleIndex] ?? titles.find(Boolean) ?? "";
  const title = selected.split(/\n\s*\n/)[0]?.trim() || selected;
  const caption = stripAllHashtagsFromCaption(source.caption);
  const hashtags = [...ensureRequiredHashtags(source.hashtags)];
  const selectedPhotoIndex = Number.isInteger(source.selectedPhotoIndex) ? source.selectedPhotoIndex : 0;
  const coverIndexSet = new Set(
    (Array.isArray(source.coverPhotoIndexes)
      ? source.coverPhotoIndexes
      : [selectedPhotoIndex]
    ).filter((index) => Number.isInteger(index) && index >= 0),
  );
  const photos: RednotePublishPhoto[] = source.photos.map((photo, index) => ({
    index,
    url: photo.previewUrl,
    fileName: photoFileName(photo.name, index),
    isCover: coverIndexSet.has(index),
  }));

  return {
    titles,
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
  const seen = new Set<string>();

  const pushItem = (item: Omit<RednoteDownloadItem, "fileName" | "labelIndex"> & { fileName?: string }) => {
    const url = item.url.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    const labeled: RednoteDownloadItem = {
      key: item.key,
      url,
      kind: item.kind,
      labelIndex: items.length + 1,
      fileName: item.fileName || (item.kind === "cover" ? "rednote-cover.png" : `photo-${items.length + 1}.jpg`),
    };
    labeled.fileName = publishFileName(labeled, items.length);
    items.push(labeled);
  };

  if (pkg.coverImageUrl) {
    pushItem({
      key: "cover",
      url: pkg.coverImageUrl,
      kind: "cover",
      fileName: "rednote-cover.png",
    });
  }
  for (const photo of pkg.photos) {
    pushItem({
      key: `photo-${photo.index}`,
      url: photo.url,
      kind: "photo",
      fileName: photo.fileName,
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
  const value = text.trim() ? text : "";
  if (!value || typeof document === "undefined") return false;

  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* iOS / in-app browsers often block Clipboard API; fall through. */
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.contentEditable = "true";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0.01";
  textarea.style.zIndex = "-1";
  textarea.style.webkitUserSelect = "text";
  textarea.style.userSelect = "text";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

export async function copyRednoteText(text: string) {
  if (typeof document === "undefined") return false;
  return copyWithFallback(text);
}

/** Clipboard is helpful but optional. Failure must not block sharing. */
export async function copyPublishText(text: string): Promise<boolean> {
  return copyRednoteText(text);
}

export type SaveImagesResult = "shared" | "downloaded" | "long-press" | "cancelled" | "failed";

function imageMime(fileName: string, blobType: string) {
  if (blobType.startsWith("image/")) return blobType;
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  return "image/jpeg";
}

function imageFileName(fileName: string, mime: string) {
  const ext = extensionFromMime(mime);
  if (ext && /\.(png|jpe?g|webp)$/i.test(fileName)) {
    return fileName.replace(/\.(png|jpe?g|webp)$/i, `.${ext}`);
  }
  if (/\.(png|jpe?g|webp)$/i.test(fileName)) return fileName;
  if (mime === "image/png") return `${fileName}.png`;
  if (mime === "image/webp") return `${fileName}.webp`;
  return `${fileName}.jpg`;
}

async function urlToBlob(url: string) {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Failed to fetch image");
  }
  if (!response.ok && !url.startsWith("data:") && !url.startsWith("blob:")) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.blob();
}

export async function urlToFile(url: string, fileName: string, mimeType?: string): Promise<File> {
  const blob = await urlToBlob(url);
  let mime = mimeType?.trim() || "";
  if (!mime && url.startsWith("data:")) {
    mime = url.slice(5).split(/[;,]/)[0] || "";
  }
  mime = mime || imageMime(fileName, blob.type);
  const named = imageFileName(fileName, mime);
  return new File([blob], named, { type: mime });
}

async function urlToObjectUrl(url: string) {
  const blob = await urlToBlob(url);
  return URL.createObjectURL(blob);
}

async function itemToImageFile(item: RednoteDownloadItem) {
  return urlToFile(item.url, item.fileName);
}

function probeShareFile() {
  return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "rednote-cover.png", {
    type: "image/png",
  });
}

function canShareData(data: ShareData) {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

export function canShareFiles(files?: File[]) {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  if (typeof window !== "undefined" && !window.isSecureContext) return false;
  if (files && files.length === 0) return false;
  const payload = files && files.length > 0 ? files : [probeShareFile()];
  try {
    return navigator.canShare({ files: payload });
  } catch {
    return false;
  }
}

export function canShareImagesToPhotos() {
  return canShareFiles();
}

export async function buildPublishFiles(pkg: RednotePublishPackage): Promise<File[]> {
  const items = collectRednoteDownloads(pkg);
  const files: File[] = [];
  for (const [index, item] of items.entries()) {
    files.push(await urlToFile(item.url, publishFileName(item, index)));
  }
  return files;
}

export async function buildPublishFilesLenient(pkg: RednotePublishPackage) {
  const items = collectRednoteDownloads(pkg);
  const files: File[] = [];
  let failed = 0;
  for (const [index, item] of items.entries()) {
    try {
      files.push(await urlToFile(item.url, publishFileName(item, index)));
    } catch {
      failed += 1;
    }
  }
  return { files, items, failed };
}

export function isUserCancellation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError";
}

async function sharePublishFiles(files: File[]): Promise<"shared" | "cancelled" | "failed"> {
  if (files.length === 0 || typeof navigator.share !== "function") return "failed";
  if (!canShareData({ files })) return "failed";
  try {
    await navigator.share({ files });
    return "shared";
  } catch (error) {
    if (isUserCancellation(error)) return "cancelled";
    return "failed";
  }
}

async function shareImageFiles(files: File[]) {
  if (files.length === 0 || typeof navigator.share !== "function") return "failed" as const;
  const shared = await sharePublishFiles(files);
  if (shared === "shared" || shared === "cancelled") return shared;
  return "failed" as const;
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
 * Content is not passed through the URL — no undocumented params.
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
