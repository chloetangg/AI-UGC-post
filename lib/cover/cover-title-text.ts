import { stripHashtagsFromTitle } from "@/lib/title-keywords";

const graphemeSegmenter = (() => {
  try {
    return new Intl.Segmenter("zh", { granularity: "grapheme" });
  } catch {
    return null;
  }
})();

export function toCoverGraphemes(text: string) {
  if (!text) return [];
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

export function sanitizeCoverLine(raw: string) {
  return stripHashtagsFromTitle(raw)
    .replace(/📍|⏰/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0E\uFE0F\u200D\u200B\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countHanChars(text: string) {
  return text.match(/\p{Script=Han}/gu)?.length ?? 0;
}

export function countCoverChars(text: string) {
  return toCoverGraphemes(sanitizeCoverLine(text)).length;
}
