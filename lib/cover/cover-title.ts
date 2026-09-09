import { containsHarshNegative } from "@/lib/compliance/negative-feedback";
import { splitTitleIntoLines } from "./title-lines";
import {
  countCoverChars,
  countHanChars,
  sanitizeCoverLine,
} from "./cover-title-text";
import {
  coverFallbackPairs,
  countCoverUnits,
  coverKeywordPairKey,
  hasCoverKsp,
  hasExactCoverKeywordPair,
  hasMandatoryCoverKeyword,
  isCoverKeywordStuffing,
  normalizeCoverLocations,
  uniqueCoverPoolKeywords,
  usesUnselectedCoverLocation,
  type CoverTitleContext,
} from "./cover-rules";

export {
  countCoverChars,
  countHanChars,
  sanitizeCoverLine,
} from "./cover-title-text";
export {
  countCoverUnits,
  formatCoverTitleRules,
  hasCoverKsp,
  hasExactCoverKeywordPair,
  hasMandatoryCoverKeyword,
  type CoverTitleContext,
} from "./cover-rules";

export const MIN_MAIN_TITLE_CHARS = 4;
export const PREFERRED_MAIN_TITLE_CHARS = 7;
export const MAX_MAIN_TITLE_CHARS = 7;
export const MIN_SUB_TITLE_CHARS = 4;
export const MAX_SUB_TITLE_CHARS = 9;

/** @deprecated Use MIN_MAIN_TITLE_CHARS */
export const MIN_COVER_TITLE_CHARS = MIN_MAIN_TITLE_CHARS;
/** @deprecated Use MAX_MAIN_TITLE_CHARS */
export const MAX_COVER_TITLE_CHARS = MAX_MAIN_TITLE_CHARS;
export const PREFERRED_COVER_TITLE_HAN = PREFERRED_MAIN_TITLE_CHARS;
export const MAX_COVER_TITLE_HAN = MAX_MAIN_TITLE_CHARS;

export const FALLBACK_COVER_PAIRS = [
  { title: "曼谷必吃", subtitle: "招牌泰式料理" },
  { title: "曼谷美食", subtitle: "家常泰式料理" },
  { title: "曼谷泰餐", subtitle: "招牌菜值得试" },
  { title: "泰餐必吃", subtitle: "招牌泰式料理" },
  { title: "美食必吃", subtitle: "家常泰式料理" },
  { title: "必吃泰餐", subtitle: "招牌菜值得试" },
  { title: "曼谷探店", subtitle: "必吃招牌料理" },
  { title: "特色泰餐", subtitle: "曼谷招牌料理" },
  { title: "美食推荐", subtitle: "泰餐招牌味道" },
  { title: "centralwOrld美食", subtitle: "招牌泰式料理" },
  { title: "centralwOrld泰餐", subtitle: "人气招牌料理" },
  { title: "centralwOrld必吃", subtitle: "特色招牌好味道" },
] as const;

export const FALLBACK_COVER_TITLES = FALLBACK_COVER_PAIRS.map((item) => item.title);
export const FALLBACK_COVER_TITLE = FALLBACK_COVER_PAIRS[0].title;

const DANGLING_TAILS = [
  "真的很",
  "真的太",
  "好吃到",
  "没想到这么",
  "原来这么",
  "来曼谷一定",
  "喜欢泰餐的",
  "这家一定",
  "一口就",
  "一定要",
  "有点",
  "特别",
  "非常",
  "真的",
  "很好",
  "太好",
  "超好",
  "很惊",
  "终于",
  "一定",
  "不能",
  "这碗",
  "这口",
  "这顿",
  "值得",
  "很",
  "太",
  "超",
  "最",
  "更",
] as const;

export function looksIncompleteCover(text: string) {
  const cleaned = sanitizeCoverLine(text);
  if (countCoverUnits(cleaned) < 3) return true;
  if (/[｜|/,，、]$/.test(cleaned)) return true;
  if (/[｜|]/.test(cleaned)) {
    const tail = cleaned.split(/[｜|]/).at(-1)?.trim() ?? "";
    if (!tail || DANGLING_TAILS.some((item) => tail === item || tail.endsWith(item))) {
      return true;
    }
  }
  if (/这家$/.test(cleaned) && !/[吃冲来试]这家$/.test(cleaned)) return true;
  return DANGLING_TAILS.some((tail) => cleaned.endsWith(tail));
}

const FORBIDDEN_COVER_CLAIMS =
  /最好吃|封神|顶级|最强|唯一|全网第一|曼谷第一|明星爱吃|名人推荐|泰国人也爱|泰国人爱吃|本地人爱吃|本地人都/;

function comparableHan(text: string) {
  return sanitizeCoverLine(text).replace(/[^\p{Script=Han}]+/gu, "");
}

function copiedFromPostTitle(coverTitle: string, postTitle: string) {
  const cover = comparableHan(coverTitle);
  const post = comparableHan(postTitle);
  return Boolean(cover && post && cover === post);
}

function repeatsMain(main: string, sub: string) {
  const a = comparableHan(main);
  const b = comparableHan(sub);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  if (b.length >= 3 && a.includes(b)) return true;
  return false;
}

function prepareCoverLine(raw: string) {
  return normalizeCoverLocations(sanitizeCoverLine(raw));
}

export function isAcceptableMainTitle(
  title: string,
  postTitles: string[] = [],
  context: CoverTitleContext = {},
) {
  const cleaned = prepareCoverLine(title);
  const units = countCoverUnits(cleaned);
  if (units < MIN_MAIN_TITLE_CHARS || units > MAX_MAIN_TITLE_CHARS) return false;
  if (looksIncompleteCover(cleaned)) return false;
  if (FORBIDDEN_COVER_CLAIMS.test(cleaned)) return false;
  if (containsHarshNegative(cleaned)) return false;
  if (/#|📍|⏰|http|www\.|\+\d/.test(cleaned)) return false;
  if (countHanChars(cleaned) < 2 && !hasMandatoryCoverKeyword(cleaned)) return false;
  if (usesUnselectedCoverLocation(cleaned, context.branch)) return false;
  if (postTitles.some((postTitle) => copiedFromPostTitle(cleaned, postTitle))) return false;
  return true;
}

export function isAcceptableSubtitle(
  subtitle: string,
  mainTitle = "",
  context: CoverTitleContext = {},
) {
  const cleaned = prepareCoverLine(subtitle);
  const units = countCoverUnits(cleaned);
  if (!cleaned) return false;
  if (units < MIN_SUB_TITLE_CHARS || units > MAX_SUB_TITLE_CHARS) return false;
  if (looksIncompleteCover(cleaned)) return false;
  if (FORBIDDEN_COVER_CLAIMS.test(cleaned)) return false;
  if (containsHarshNegative(cleaned)) return false;
  if (/#|📍|⏰|http|www\.|\+\d/.test(cleaned)) return false;
  if (usesUnselectedCoverLocation(cleaned, context.branch)) return false;
  if (mainTitle && repeatsMain(mainTitle, cleaned)) return false;
  return true;
}

export function isAcceptableCoverOverlay(
  title: string,
  subtitle = "",
  postTitles: string[] = [],
  context: CoverTitleContext = {},
) {
  if (!isAcceptableMainTitle(title, postTitles, context)) return false;
  if (!isAcceptableSubtitle(subtitle, title, context)) return false;
  if (!hasExactCoverKeywordPair(title, subtitle)) return false;
  if (!hasCoverKsp(title, subtitle)) return false;
  if (isCoverKeywordStuffing(title, subtitle)) return false;
  return true;
}

function pickFallbackPair(postTitles: string[], context: CoverTitleContext = {}) {
  const blocked = new Set(postTitles.map((title) => comparableHan(title)).filter(Boolean));
  const previousPair = coverKeywordPairKey(context.previousCoverTitle ?? "");
  const previousMain = comparableHan((context.previousCoverTitle ?? "").split("/")[0] ?? "");
  const pool = [
    ...coverFallbackPairs({ ...context, postTitles }),
    ...FALLBACK_COVER_PAIRS,
  ].filter((item) => !blocked.has(comparableHan(item.title)));
  const choices = pool.length > 0 ? pool : [...FALLBACK_COVER_PAIRS];
  const valid = choices.filter((item) =>
    isAcceptableCoverOverlay(item.title, item.subtitle, postTitles, context),
  );
  const diverse = valid.filter((item) => {
    if (previousPair && coverKeywordPairKey(item.title, item.subtitle) === previousPair) return false;
    if (previousMain && comparableHan(item.title) === previousMain) return false;
    return true;
  });
  const use = diverse.length > 0 ? diverse : valid.length > 0 ? valid : choices;
  const seed = (context.variantIndex ?? 0) + postTitles.reduce((sum, title) => sum + title.length, 0);
  return use[seed % use.length] ?? FALLBACK_COVER_PAIRS[seed % FALLBACK_COVER_PAIRS.length];
}

export function splitCoverTitleSemantically(title: string, subtitle = "") {
  const first = prepareCoverLine(title);
  const second = prepareCoverLine(subtitle);
  if (second) return { title: first, subtitle: second };
  const split = splitTitleIntoLines(first, { oneLineMax: PREFERRED_MAIN_TITLE_CHARS });
  return { title: split.line1, subtitle: split.line2 };
}

export function splitCoverTitleForTwoGraphics(title: string, subtitle = "") {
  return splitCoverTitleSemantically(title, subtitle);
}

export function layoutCoverOverlay(
  rawTitle: string,
  rawSubtitle = "",
  postTitles: string[] = [],
  context: CoverTitleContext = {},
) {
  const first = prepareCoverLine(rawTitle);
  const second = prepareCoverLine(rawSubtitle);

  if (isAcceptableCoverOverlay(first, second, postTitles, context)) {
    return { title: first, subtitle: second };
  }

  if (
    isAcceptableMainTitle(first, postTitles, context) &&
    uniqueCoverPoolKeywords(first).length <= 2
  ) {
    const fallback = pickFallbackPair(postTitles, context);
    if (isAcceptableCoverOverlay(first, fallback.subtitle, postTitles, context)) {
      return { title: first, subtitle: fallback.subtitle };
    }
  }

  return pickFallbackPair(postTitles, context);
}

export function normalizeCoverTitle(raw: string, postTitles: string[] = [], context: CoverTitleContext = {}) {
  return layoutCoverOverlay(raw, "", postTitles, context).title;
}

export function splitCoverTitle(coverTitle: string, subtitle = "", context: CoverTitleContext = {}) {
  return layoutCoverOverlay(coverTitle, subtitle, [], context);
}
