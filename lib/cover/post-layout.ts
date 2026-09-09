import { DEFAULT_COVER_TEMPLATE_ID } from "@/types/content";

export const FOUR_PHOTO_GRID_TEMPLATE_ID = "top-stroke";
export const FOUR_PHOTO_GRID_TEMPLATE_IDS = ["top-stroke", "badge-stack", "dual-line"] as const;

export function isFourGridTemplateId(templateId: string) {
  return (FOUR_PHOTO_GRID_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isFourPhotoGridCover(photoCount: number, templateId: string) {
  return photoCount >= 4 && isFourGridTemplateId(templateId);
}

export const COVER_TEMPLATE_OPTIONS = [
  { id: "top-stroke", en: "Style 1", zh: "Style 1" },
  { id: "bottom-bar", en: "Style 2", zh: "Style 2" },
  { id: "bottom-card", en: "Style 3", zh: "Style 3" },
  { id: "top-banner", en: "Style 4", zh: "Style 4" },
  { id: "left-spine", en: "Style 5", zh: "Style 5" },
  { id: "polaroid", en: "Style 6", zh: "Style 6" },
  { id: "center-lower", en: "Style 7", zh: "Style 7" },
  { id: "badge-stack", en: "Style 8", zh: "Style 8" },
  { id: "split-band", en: "Style 9", zh: "Style 9" },
  { id: "dual-line", en: "Style 10", zh: "Style 10" },
] as const;

export type CoverTemplateOptionId = (typeof COVER_TEMPLATE_OPTIONS)[number]["id"];

export function isCoverTemplateId(value: string): value is CoverTemplateOptionId {
  return COVER_TEMPLATE_OPTIONS.some((item) => item.id === value);
}

function insertMissingByOriginalIndex(ordered: number[], pool: number[]) {
  const seen = new Set(ordered);
  const result = [...ordered];
  for (const index of pool) {
    if (seen.has(index)) continue;
    let insertAt = result.length;
    for (let position = 0; position < result.length; position += 1) {
      if (result[position] > index) {
        insertAt = position;
        break;
      }
    }
    result.splice(insertAt, 0, index);
    seen.add(index);
  }
  return result;
}

export const REMAINING_ORDER_PATTERNS = ["1", "2", "3", "4", "5", "6"] as const;
export type RemainingOrderPattern = (typeof REMAINING_ORDER_PATTERNS)[number];

function pickRandomTemplate(ids: CoverTemplateOptionId[]): CoverTemplateOptionId | undefined {
  if (ids.length === 0) return undefined;
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.getRandomValues === "function") {
    const bytes = new Uint8Array(1);
    cryptoObj.getRandomValues(bytes);
    return ids[bytes[0] % ids.length];
  }
  return ids[Math.floor(Math.random() * ids.length)];
}

/**
 * Website assigns the visible cover style.
 * The model copies prompt samples (especially left-spine / Style 5), so `selected` is ignored.
 */
export function autoMatchTemplate(input: {
  selected?: string | null;
  suitable?: string[] | null;
  previousTemplateId?: string | null;
  recentTemplateIds?: string[] | null;
}): CoverTemplateOptionId {
  const all = COVER_TEMPLATE_OPTIONS.map((item) => item.id);
  const previous =
    input.previousTemplateId && isCoverTemplateId(input.previousTemplateId)
      ? input.previousTemplateId
      : "";
  const recent = (input.recentTemplateIds ?? []).filter(isCoverTemplateId);
  const avoid = new Set<string>([previous, ...recent].filter(Boolean));
  const unused = all.filter((id) => !avoid.has(id));
  const pool = unused.length > 0 ? unused : all.filter((id) => id !== previous);
  return pickRandomTemplate(pool.length > 0 ? pool : all) ?? DEFAULT_COVER_TEMPLATE_ID;
}

export function parseRemainingPhotoIndexes(
  value: unknown,
  coverSourceIndex: number,
  photoCount: number,
  templateId: string,
) {
  const all = Array.from({ length: Math.max(photoCount, 0) }, (_, index) => index);
  const fourGrid = isFourPhotoGridCover(photoCount, templateId);
  const remaining = fourGrid ? all : all.filter((index) => index !== coverSourceIndex);
  const allowed = new Set(remaining);
  const seen = new Set<number>();
  const ordered: number[] = [];
  const raw = Array.isArray(value) ? value : [];
  for (const item of raw) {
    const index = typeof item === "number" ? item : Number.parseInt(String(item ?? ""), 10);
    if (!allowed.has(index) || seen.has(index)) continue;
    seen.add(index);
    ordered.push(index);
  }
  if (fourGrid) {
    return insertMissingByOriginalIndex(ordered, remaining);
  }
  for (const index of remaining) {
    if (seen.has(index)) continue;
    ordered.push(index);
  }
  return ordered;
}

export function photosInIndexOrder<T>(photos: T[], indexes: number[]) {
  const ordered: T[] = [];
  const seen = new Set<number>();
  for (const index of indexes) {
    if (!Number.isInteger(index) || seen.has(index) || !photos[index]) continue;
    seen.add(index);
    ordered.push(photos[index]);
  }
  return ordered;
}

export function remainingPostPhotoIndexes(
  photoCount: number,
  coverSourceIndex: number,
  templateId: string,
  remainingOrder: unknown = [],
) {
  return parseRemainingPhotoIndexes(remainingOrder, coverSourceIndex, photoCount, templateId);
}

export function remainingPostPhotos<T extends { id: string }>(
  photos: T[],
  templateId: string,
  coverSource: {
    id?: string | null;
    index?: number;
    remainingOrder?: unknown;
  },
) {
  if (isFourPhotoGridCover(photos.length, templateId)) {
    return photosInIndexOrder(
      photos,
      parseRemainingPhotoIndexes(
        coverSource.remainingOrder,
        coverSource.index ?? 0,
        photos.length,
        templateId,
      ),
    );
  }
  const sourceId = coverSource.id || photos[coverSource.index ?? 0]?.id;
  if (!sourceId) return photos;
  return photos.filter((photo) => photo.id !== sourceId);
}

export type FinalSlide = {
  id: string;
  src: string;
  kind: "cover" | "photo";
};

export function buildFinalSlides(
  photos: Array<{ id: string; previewUrl: string }>,
  cover: {
    generatedCoverImageUrl: string | null;
    selectedPhotoIndex: number;
    selectedCoverTemplateId?: string;
    coverSourcePhotoId?: string | null;
    remainingPhotoIds?: string[] | null;
  } | null,
): FinalSlide[] {
  const templateId = cover?.selectedCoverTemplateId || DEFAULT_COVER_TEMPLATE_ID;
  const slides: FinalSlide[] = [];
  if (cover?.generatedCoverImageUrl) {
    slides.push({
      id: "generated-cover",
      src: cover.generatedCoverImageUrl,
      kind: "cover",
    });
  }
  if (!cover) {
    return photos.map((photo) => ({
      id: photo.id,
      src: photo.previewUrl,
      kind: "photo" as const,
    }));
  }
  const fourGrid = isFourPhotoGridCover(photos.length, templateId);
  const fromIds = (cover.remainingPhotoIds ?? [])
    .map((id) => photos.find((photo) => photo.id === id))
    .filter((photo): photo is { id: string; previewUrl: string } => Boolean(photo))
    .filter((photo) => (fourGrid ? true : photo.id !== cover.coverSourcePhotoId));
  const remaining =
    fromIds.length > 0
      ? fromIds
      : remainingPostPhotos(photos, templateId, {
          id: cover.coverSourcePhotoId,
          index: cover.selectedPhotoIndex,
        });
  for (const photo of remaining) {
    slides.push({
      id: photo.id,
      src: photo.previewUrl,
      kind: "photo",
    });
  }
  return slides;
}
