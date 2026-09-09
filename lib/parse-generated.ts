import { layoutCoverOverlay, type CoverTitleContext } from "@/lib/cover/cover-title";
import { normalizePhotoIndexes } from "@/lib/cover/collage";
import {
  autoMatchTemplate,
  parseRemainingPhotoIndexes,
} from "@/lib/cover/post-layout";
import { normalizeHashtags, stripAllHashtagsFromCaption } from "@/lib/hashtags";
import { stripHashtagsFromTitle } from "@/lib/title-keywords";
import type { GeneratedContent } from "@/types/content";

type RawGenerated = {
  titles?: unknown;
  caption?: unknown;
  hashtags?: unknown;
  coverTitle?: unknown;
  coverSubtitle?: unknown;
  mainTitle?: unknown;
  subTitle?: unknown;
  coverTitles?: unknown;
  selectedPhotoIndex?: unknown;
  selectedPhotoIndexes?: unknown;
  photoSelectionReason?: unknown;
  selectedTemplateId?: unknown;
  suitableTemplateIds?: unknown;
  remainingPhotoOrder?: unknown;
  remainingPhotoIndexes?: unknown;
  remainingOrderPattern?: unknown;
  selectedKspId?: unknown;
  selectedStorylineId?: unknown;
  selectedContentAngleId?: unknown;
  selectedSearchKeyword?: unknown;
};

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function cleanCoverTitle(value: string) {
  return stripHashtagsFromTitle(value)
    .replace(/📍|⏰/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePhotoIndex(value: unknown, photoCount: number) {
  const maxIndex = Math.max(photoCount - 1, 0);
  const raw = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(raw) || raw < 0 || raw > maxIndex) return 0;
  return raw;
}

function parsePhotoIndexes(value: unknown, primary: number, photoCount: number) {
  const raw = Array.isArray(value)
    ? value.map((item) => (typeof item === "number" ? item : Number.parseInt(String(item ?? ""), 10)))
    : [];
  return normalizePhotoIndexes(raw, primary, photoCount);
}

function asCoverOverlay(parsed: RawGenerated, postTitles: string[], context: CoverTitleContext = {}) {
  const direct = String(parsed.mainTitle ?? parsed.coverTitle ?? "");
  const subtitle = String(parsed.subTitle ?? parsed.coverSubtitle ?? "");
  const source = direct.trim()
    ? direct
    : (asStringArray(parsed.coverTitles).find(Boolean) ?? "");
  return layoutCoverOverlay(source, subtitle, postTitles, context);
}

export function parseGeneratedContent(
  raw: string,
  photoCount = 1,
  previousTemplateId = "",
  coverContext: CoverTitleContext = {},
): GeneratedContent {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as RawGenerated;
  const titles = asStringArray(parsed.titles).map(stripHashtagsFromTitle);
  const caption = stripAllHashtagsFromCaption(String(parsed.caption ?? "").trim());

  if (titles.length < 3 || !caption) {
    throw new Error("Incomplete model output");
  }

  const postTitles: [string, string, string] = [titles[0], titles[1], titles[2]];
  const overlay = asCoverOverlay(parsed, postTitles, coverContext);
  const selectedPhotoIndex = parsePhotoIndex(parsed.selectedPhotoIndex, photoCount);
  const selectedTemplateId = autoMatchTemplate({
    selected: String(parsed.selectedTemplateId ?? ""),
    suitable: asStringArray(parsed.suitableTemplateIds),
    previousTemplateId,
  });

  return {
    titles: postTitles,
    caption,
    hashtags: normalizeHashtags(asStringArray(parsed.hashtags)),
    coverTitle: overlay.title,
    coverSubtitle: overlay.subtitle,
    selectedPhotoIndex,
    selectedPhotoIndexes: parsePhotoIndexes(
      parsed.selectedPhotoIndexes,
      selectedPhotoIndex,
      photoCount,
    ),
    photoSelectionReason: cleanCoverTitle(String(parsed.photoSelectionReason ?? "")),
    selectedTemplateId,
    suitableTemplateIds: asStringArray(parsed.suitableTemplateIds),
    remainingPhotoIndexes: parseRemainingPhotoIndexes(
      parsed.remainingPhotoOrder ?? parsed.remainingPhotoIndexes,
      selectedPhotoIndex,
      photoCount,
      selectedTemplateId,
    ),
    remainingOrderPattern: String(parsed.remainingOrderPattern ?? "").trim(),
    selectedKspId: String(parsed.selectedKspId ?? "").trim() || undefined,
    selectedStorylineId: String(parsed.selectedStorylineId ?? "").trim() || undefined,
    selectedContentAngleId: String(parsed.selectedContentAngleId ?? "").trim() || undefined,
    selectedSearchKeyword: String(parsed.selectedSearchKeyword ?? "").trim() || undefined,
  };
}
