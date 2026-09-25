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
  { id: "top-stroke", en: "Cover 1", zh: "封面 1", th: "ปก 1" },
  { id: "dual-line", en: "Cover 2", zh: "封面 2", th: "ปก 2" },
  { id: "top-banner", en: "Cover 3", zh: "封面 3", th: "ปก 3" },
  { id: "polaroid", en: "Cover 4", zh: "封面 4", th: "ปก 4" },
  { id: "center-lower", en: "Cover 5", zh: "封面 5", th: "ปก 5" },
  { id: "photo-only", en: "Cover 6", zh: "封面 6", th: "ปก 6" },
] as const;

export type CoverTemplateOptionId = (typeof COVER_TEMPLATE_OPTIONS)[number]["id"];

export function isCoverTemplateId(value: string): value is CoverTemplateOptionId {
  return COVER_TEMPLATE_OPTIONS.some((item) => item.id === value);
}

export const REMAINING_ORDER_PATTERNS = ["1", "2", "3", "4", "5", "6"] as const;
export type RemainingOrderPattern = (typeof REMAINING_ORDER_PATTERNS)[number];

const PREFERRED_FOUR_PHOTO_TEMPLATE_IDS: readonly CoverTemplateOptionId[] = ["top-stroke", "dual-line"];

function randomIndex(length: number) {
  if (length <= 1) return 0;
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.getRandomValues === "function") {
    const span = 256 - (256 % length);
    const bytes = new Uint8Array(1);
    let value = 255;
    do {
      cryptoObj.getRandomValues(bytes);
      value = bytes[0];
    } while (value >= span);
    return value % length;
  }
  return Math.floor(Math.random() * length);
}

function pickRandomTemplate(ids: CoverTemplateOptionId[]): CoverTemplateOptionId | undefined {
  if (ids.length === 0) return undefined;
  return ids[randomIndex(ids.length)];
}

function withoutRecentTemplates(
  ids: CoverTemplateOptionId[],
  recent: string[],
  previous?: string | null,
): CoverTemplateOptionId[] {
  const blocked = new Set(
    [previous, ...recent.slice(-2)].filter((id): id is string => Boolean(id)),
  );
  const fresh = ids.filter((id) => !blocked.has(id));
  if (fresh.length > 0) return fresh;
  const notPrevious = ids.filter((id) => id !== previous);
  return notPrevious.length > 0 ? notPrevious : [...ids];
}

function pickFromPool(ids: CoverTemplateOptionId[], photoCount: number): CoverTemplateOptionId | undefined {
  if (ids.length === 0) return undefined;
  if (photoCount < 4) return pickRandomTemplate(ids);

  const preferred = new Set<string>(PREFERRED_FOUR_PHOTO_TEMPLATE_IDS);
  const bag: CoverTemplateOptionId[] = [];
  for (const id of ids) {
    const copies = preferred.has(id) ? 3 : 1;
    for (let i = 0; i < copies; i += 1) bag.push(id);
  }
  return pickRandomTemplate(bag);
}

/**
 * Final Style is local: random among Style 1–6.
 * Ignore AI selectedTemplateId / suitableTemplateIds.
 * Avoid the last 1–2 styles so regenerate is not the same cover.
 * photoCount >= 4: Style 1 and Style 2 get higher weight (four-grid).
 * Manual Style taps do not call this.
 */
export function autoMatchTemplate(input: {
  selected?: string | null;
  suitable?: string[] | null;
  previousTemplateId?: string | null;
  recentTemplateIds?: string[] | null;
  photoCount?: number;
}): CoverTemplateOptionId {
  void input.selected;
  void input.suitable;
  const all = COVER_TEMPLATE_OPTIONS.map((item) => item.id);
  const photoCount = Number.isFinite(input.photoCount) ? Math.max(0, Number(input.photoCount)) : 0;
  const recent = Array.isArray(input.recentTemplateIds)
    ? input.recentTemplateIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  const pool = withoutRecentTemplates(all, recent, input.previousTemplateId);
  return pickFromPool(pool, photoCount) ?? pickRandomTemplate(all) ?? DEFAULT_COVER_TEMPLATE_ID;
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
