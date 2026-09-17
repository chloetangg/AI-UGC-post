import { DEFAULT_COVER_TEMPLATE_ID } from "@/types/content";

export const PHOTO_ONLY_TEMPLATE_ID = "photo-only";

export function isPhotoOnlyTemplate(templateId: string) {
  return templateId === PHOTO_ONLY_TEMPLATE_ID;
}

export const FOUR_PHOTO_GRID_TEMPLATE_ID = "top-stroke";
export const FOUR_PHOTO_GRID_TEMPLATE_IDS = ["top-stroke", "badge-stack", "dual-line"] as const;

export function isFourGridTemplateId(templateId: string) {
  return (FOUR_PHOTO_GRID_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

export function isFourPhotoGridCover(photoCount: number, templateId: string) {
  return photoCount >= 4 && isFourGridTemplateId(templateId);
}

export const COVER_TEMPLATE_OPTIONS = [
  { id: "top-stroke", en: "Style 1", zh: "风格 1", th: "สไตล์ 1" },
  { id: "dual-line", en: "Style 2", zh: "风格 2", th: "สไตล์ 2" },
  { id: "top-banner", en: "Style 3", zh: "风格 3", th: "สไตล์ 3" },
  { id: "polaroid", en: "Style 4", zh: "风格 4", th: "สไตล์ 4" },
  { id: "center-lower", en: "Style 5", zh: "风格 5", th: "สไตล์ 5" },
  { id: "photo-only", en: "Style 6", zh: "风格 6", th: "สไตล์ 6" },
] as const;

export type CoverTemplateOptionId = (typeof COVER_TEMPLATE_OPTIONS)[number]["id"];

export function isCoverTemplateId(value: string): value is CoverTemplateOptionId {
  return COVER_TEMPLATE_OPTIONS.some((item) => item.id === value);
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

function uniqueCoverTemplateIds(raw: Array<string | null | undefined> | null | undefined): CoverTemplateOptionId[] {
  const seen = new Set<CoverTemplateOptionId>();
  const ids: CoverTemplateOptionId[] = [];
  for (const item of raw ?? []) {
    if (!item || !isCoverTemplateId(item) || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

/**
 * Two-phase Style pick:
 * 1) composition pool = AI suitableTemplateIds (photo-only if none fit)
 * 2) history avoidance + random inside that pool
 * `selected` is ignored. Manual Style taps do not call this.
 */
export function autoMatchTemplate(input: {
  selected?: string | null;
  suitable?: string[] | null;
  previousTemplateId?: string | null;
  recentTemplateIds?: string[] | null;
}): CoverTemplateOptionId {
  void input.selected;
  const suitable = uniqueCoverTemplateIds(input.suitable);
  const compositionPool =
    suitable.length > 0 ? suitable : ([PHOTO_ONLY_TEMPLATE_ID] as CoverTemplateOptionId[]);

  if (compositionPool.length === 1) {
    return compositionPool[0];
  }

  const previous =
    input.previousTemplateId && isCoverTemplateId(input.previousTemplateId)
      ? input.previousTemplateId
      : "";
  const recent = uniqueCoverTemplateIds(input.recentTemplateIds ?? []);
  const avoid = new Set<string>([previous, ...recent].filter(Boolean));
  const unused = compositionPool.filter((id) => !avoid.has(id));
  if (unused.length > 0) {
    return pickRandomTemplate(unused) ?? compositionPool[0];
  }
  const notPrevious = compositionPool.filter((id) => id !== previous);
  if (notPrevious.length > 0) {
    return pickRandomTemplate(notPrevious) ?? compositionPool[0];
  }
  return pickRandomTemplate(compositionPool) ?? DEFAULT_COVER_TEMPLATE_ID;
}

function uniqueAllowedIndexes(value: unknown, allowed: Set<number>) {
  const seen = new Set<number>();
  const ordered: number[] = [];
  const raw = Array.isArray(value) ? value : [];
  for (const item of raw) {
    const index = typeof item === "number" ? item : Number.parseInt(String(item ?? ""), 10);
    if (!allowed.has(index) || seen.has(index)) continue;
    seen.add(index);
    ordered.push(index);
  }
  return ordered;
}

function remainingPhotoPool(photoCount: number, coverSourceIndex: number, templateId: string) {
  const all = Array.from({ length: Math.max(photoCount, 0) }, (_, index) => index);
  if (isFourPhotoGridCover(photoCount, templateId)) return all;
  return all.filter((index) => index !== coverSourceIndex);
}

function usesFourGridCoverOrder(ordered: number[], coverPhotoIndexes: number[], pool: number[]) {
  const allowed = new Set(pool);
  const grid = uniqueAllowedIndexes(coverPhotoIndexes, allowed);
  if (grid.length < Math.min(4, pool.length) || ordered.length < grid.length) return false;
  return grid.every((index, position) => ordered[position] === index);
}

/**
 * Body-carousel originals after the composed cover.
 * Four-grid: keep ALL original uploads and re-sort them. Never drop grid photos.
 * Non-grid: exclude the cover source original. Never reuse that photo in the body.
 * The composed cover JPG is never part of this list.
 */
export function parseRemainingPhotoIndexes(
  value: unknown,
  coverSourceIndex: number,
  photoCount: number,
  templateId: string,
  coverPhotoIndexes: number[] = [],
) {
  const pool = remainingPhotoPool(photoCount, coverSourceIndex, templateId);
  const allowed = new Set(pool);
  let ordered = uniqueAllowedIndexes(value, allowed);
  if (isFourPhotoGridCover(photoCount, templateId) && usesFourGridCoverOrder(ordered, coverPhotoIndexes, pool)) {
    ordered = [];
  }
  const seen = new Set(ordered);
  for (const index of pool) {
    if (seen.has(index)) continue;
    seen.add(index);
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
  coverPhotoIndexes: number[] = [],
) {
  return parseRemainingPhotoIndexes(
    remainingOrder,
    coverSourceIndex,
    photoCount,
    templateId,
    coverPhotoIndexes,
  );
}

export function remainingPostPhotos<T extends { id: string }>(
  photos: T[],
  templateId: string,
  coverSource: {
    id?: string | null;
    index?: number;
    remainingOrder?: unknown;
    coverPhotoIndexes?: number[];
  },
) {
  const ordered = photosInIndexOrder(
    photos,
    parseRemainingPhotoIndexes(
      coverSource.remainingOrder,
      coverSource.index ?? 0,
      photos.length,
      templateId,
      coverSource.coverPhotoIndexes ?? [],
    ),
  );
  if (isFourPhotoGridCover(photos.length, templateId)) return ordered;
  const sourceId = coverSource.id || photos[coverSource.index ?? 0]?.id;
  if (!sourceId) return ordered;
  return ordered.filter((photo) => photo.id !== sourceId);
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
    selectedPhotoIndexes?: number[];
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
  const orderFromIds = (cover.remainingPhotoIds ?? [])
    .map((id) => photos.findIndex((photo) => photo.id === id))
    .filter((index) => index >= 0);
  const remaining = remainingPostPhotos(photos, templateId, {
    id: cover.coverSourcePhotoId,
    index: cover.selectedPhotoIndex,
    remainingOrder: orderFromIds,
    coverPhotoIndexes: cover.selectedPhotoIndexes ?? [],
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
