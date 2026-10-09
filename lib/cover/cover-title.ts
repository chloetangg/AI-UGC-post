import { containsHarshNegative } from "@/lib/compliance/negative-feedback";
import { splitTitleIntoLines } from "./title-lines";
import {
  countCoverChars,
  countHanChars,
  sanitizeCoverLine,
} from "./cover-title-text";
import {
  COVER_POOL_KEYWORDS,
  coverFallbackPairs,
  countCoverUnits,
  coverKeywordPairKey,
  hasCoverTitleKeyword,
  hasMandatoryCoverKeyword,
  isCoverKeywordStuffing,
  looksLikeCoverTemplateSpeak,
  normalizeCoverLocations,
  packsMultipleCoverEvidence,
  inventsUnsupportedCoverClaim,
  usesUnselectedCoverLocation,
  type CoverTitleContext,
} from "./cover-rules";
import { sanitizeCoverAbsoluteLanguage } from "./cover-absolute";
import { selectOneValidSubtitle, validateSubtitleCandidate } from "./subtitle-units";
import {
  isIncompleteCoverAction,
  isNaturalCoverChinese,
  isSpokenCompleteCoverHeadline,
  naturalCoverFallback,
  repairIncompleteCoverAction,
} from "./cover-natural";
import { collectFullDishNames, applyCoverDishShortNames, coverDishShortName, hasIllegalCoverDishShort } from "./dish-names";
import {
  evidenceLedCoverPairs,
  isWeakSeoCover,
} from "@/lib/content-evidence";

export {
  countCoverChars,
  countHanChars,
  sanitizeCoverLine,
} from "./cover-title-text";
export {
  countCoverUnits,
  formatCoverTitleRules,
  hasCoverTitleKeyword,
  hasMandatoryCoverKeyword,
  inventsUnsupportedCoverClaim,
  type CoverTitleContext,
} from "./cover-rules";

export const MIN_MAIN_TITLE_CHARS = 4;
export const PREFERRED_MAIN_TITLE_CHARS = 6;
export const MAX_MAIN_TITLE_CHARS = 10;
export const MIN_SUB_TITLE_CHARS = 6;
export const MAX_SUB_TITLE_CHARS = 15;

/** @deprecated Use MIN_MAIN_TITLE_CHARS */
export const MIN_COVER_TITLE_CHARS = MIN_MAIN_TITLE_CHARS;
/** @deprecated Use MAX_MAIN_TITLE_CHARS */
export const MAX_COVER_TITLE_CHARS = MAX_MAIN_TITLE_CHARS;
export const PREFERRED_COVER_TITLE_HAN = PREFERRED_MAIN_TITLE_CHARS;
export const MAX_COVER_TITLE_HAN = MAX_MAIN_TITLE_CHARS;

export const FALLBACK_COVER_PAIRS = [
  { title: "曼谷泰餐新体验", subtitle: "这顿吃下来很满足" },
  { title: "曼谷吃饭很舒服", subtitle: "坐下来刚好能慢慢聊" },
  { title: "必吃泰式料理", subtitle: "这几道菜还想再点" },
  { title: "曼谷隐藏泰餐", subtitle: "这顿吃下来很满足" },
  { title: "centralwOrld泰餐", subtitle: "逛完街来吃刚刚好" },
  { title: "centralwOrld必吃美食", subtitle: "坐下来刚好能慢慢聊" },
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
  "非常",
  "真的",
  "太好",
  "超好",
  "很惊",
  "终于",
  "一定",
  "不能",
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
  if (isIncompleteCoverAction(cleaned)) return true;
  return DANGLING_TAILS.some((tail) => cleaned.endsWith(tail));
}

const FORBIDDEN_COVER_CLAIMS =
  /最好吃|最爱|最强|最绝|最正宗|最值得|最推荐|最便宜|最划算|最火|之最|顶级|唯一|全网第一|曼谷第一|泰国第一|全曼谷|全泰国|必吃第一名|必须吃|明星爱吃|名人推荐|泰国人也爱|泰国人爱吃|本地人爱吃|本地人都|无敌/;

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
  return sanitizeCoverAbsoluteLanguage(normalizeCoverLocations(sanitizeCoverLine(raw)));
}

const GENERIC_SUBTITLE =
  /^(招牌泰式料理|家常泰式料理|特色泰式料理|人气招牌料理|招牌菜值得试|泰餐招牌味道|曼谷招牌料理|必吃招牌料理|特色招牌好味道|整体体验非常不错|精选泰式家常料理|品尝正宗泰式美食)$/;

export function isAcceptableMainTitle(
  title: string,
  postTitles: string[] = [],
  context: CoverTitleContext = {},
) {
  const cleaned = prepareCoverLine(title);
  const units = countCoverUnits(cleaned);
  if (units < MIN_MAIN_TITLE_CHARS || units > MAX_MAIN_TITLE_CHARS) return false;
  if (!isNaturalCoverChinese(cleaned)) return false;
  if (looksIncompleteCover(cleaned)) return false;
  if (FORBIDDEN_COVER_CLAIMS.test(cleaned)) return false;
  if (containsHarshNegative(cleaned)) return false;
  if (/#|📍|⏰|http|www\.|\+\d/.test(cleaned)) return false;
  if (!hasCoverTitleKeyword(cleaned) && !isSpokenCompleteCoverHeadline(cleaned)) return false;
  if (isCoverKeywordStuffing(cleaned)) return false;
  if (countHanChars(cleaned) < 2 && !hasMandatoryCoverKeyword(cleaned)) return false;
  if (usesUnselectedCoverLocation(cleaned, context.branch)) return false;
  if (postTitles.some((postTitle) => copiedFromPostTitle(cleaned, postTitle))) return false;
  return true;
}

function maxSubtitleUnits(_text: string, _context: CoverTitleContext) {
  return MAX_SUB_TITLE_CHARS;
}

export function isAcceptableSubtitle(
  subtitle: string,
  mainTitle = "",
  context: CoverTitleContext = {},
) {
  const cleaned = prepareCoverLine(subtitle);
  const units = countCoverUnits(cleaned);
  if (!cleaned) return false;
  const verdict = validateSubtitleCandidate(cleaned, context.diningNote ?? "");
  if (!verdict.ok) return false;
  if (units > maxSubtitleUnits(cleaned, context)) return false;
  if (looksIncompleteCover(cleaned)) return false;
  if (FORBIDDEN_COVER_CLAIMS.test(cleaned)) return false;
  if (containsHarshNegative(cleaned)) return false;
  if (looksLikeCoverTemplateSpeak(cleaned)) return false;
  if (packsMultipleCoverEvidence(cleaned, context)) return false;
  if (/#|📍|⏰|http|www\.|\+\d/.test(cleaned)) return false;
  if (usesUnselectedCoverLocation(cleaned, context.branch)) return false;
  if (mainTitle && repeatsMain(mainTitle, cleaned)) return false;
  if (GENERIC_SUBTITLE.test(cleaned)) return false;
  if (hasIllegalCoverDishShort(cleaned, context.dishes)) return false;
  if (inventsUnsupportedCoverClaim(cleaned, context)) return false;
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
  return true;
}

function pickFallbackPair(postTitles: string[], context: CoverTitleContext = {}) {
  const blocked = new Set(postTitles.map((title) => comparableHan(title)).filter(Boolean));
  const previousPair = coverKeywordPairKey(context.previousCoverTitle ?? "");
  const previousMain = comparableHan((context.previousCoverTitle ?? "").split("/")[0] ?? "");
  const pool = [
    ...evidenceLedCoverPairs(context),
    ...coverFallbackPairs({ ...context, postTitles }),
    ...FALLBACK_COVER_PAIRS,
  ].filter((item) => !blocked.has(comparableHan(item.title)) && !isWeakSeoCover(item.title));
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
  const picked = use[seed % use.length] ?? FALLBACK_COVER_PAIRS[seed % FALLBACK_COVER_PAIRS.length];
  if (isNaturalCoverChinese(picked.title) && isAcceptableMainTitle(picked.title, postTitles, context)) {
    return picked;
  }
  const rebuilt = naturalCoverFallback(context, seed);
  if (isAcceptableCoverOverlay(rebuilt, picked.subtitle, postTitles, context)) {
    return { title: rebuilt, subtitle: picked.subtitle };
  }
  return { title: rebuilt, subtitle: "这顿吃下来很满足" };
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

function firstPoolKeyword(title: string) {
  return COVER_POOL_KEYWORDS.find((keyword) => title.includes(keyword)) ?? "";
}

function fitSubtitleAroundDish(dish: string, current: string) {
  const short = coverDishShortName(dish);
  const max = maxSubtitleUnits(current.includes(short) ? current : short, { dishes: [dish] });
  if (current.includes(short) || current.includes(dish)) {
    const units = countCoverUnits(current);
    if (units >= MIN_SUB_TITLE_CHARS && units <= max) {
      return applyCoverDishShortNames(current, [dish]);
    }
  }
  const named = `没想到超爱${short}`;
  if (countCoverUnits(named) >= MIN_SUB_TITLE_CHARS && countCoverUnits(named) <= max) return named;
  const special = `这口${short}有点特别`;
  if (countCoverUnits(special) >= MIN_SUB_TITLE_CHARS && countCoverUnits(special) <= max) return special;
  if (countCoverUnits("没想到超爱这道") <= MAX_SUB_TITLE_CHARS) return "没想到超爱这道";
  return short;
}

function applyCoverDishNames(
  title: string,
  subtitle: string,
  postTitles: string[],
  context: CoverTitleContext,
) {
  const fullNames = collectFullDishNames({
    dishes: context.dishes,
    sourceTexts: [...(context.sourceTexts ?? []), ...postTitles, context.diningNote ?? ""],
  });
  if (fullNames.length === 0) return { title, subtitle };

  let nextTitle = applyCoverDishShortNames(title, fullNames);
  let nextSubtitle = applyCoverDishShortNames(subtitle, fullNames);
  if (isAcceptableCoverOverlay(nextTitle, nextSubtitle, postTitles, context)) {
    return { title: nextTitle, subtitle: nextSubtitle };
  }

  const dishesInTitle = fullNames.filter(
    (name) => nextTitle.includes(name) || nextTitle.includes(coverDishShortName(name)),
  );
  if (dishesInTitle.length > 0 && countCoverUnits(nextTitle) > MAX_MAIN_TITLE_CHARS) {
    const dish = dishesInTitle[0];
    const short = coverDishShortName(dish);
    const keyword = firstPoolKeyword(nextTitle) || "曼谷";
    const compact = `${keyword}${short}`;
    if (
      countCoverUnits(compact) >= MIN_MAIN_TITLE_CHARS &&
      countCoverUnits(compact) <= MAX_MAIN_TITLE_CHARS &&
      isAcceptableMainTitle(compact, postTitles, context)
    ) {
      nextTitle = compact;
    } else {
      let withoutDish = nextTitle;
      for (const name of dishesInTitle) {
        withoutDish = withoutDish.split(name).join("").split(coverDishShortName(name)).join("");
      }
      withoutDish = prepareCoverLine(withoutDish);
      if (!isAcceptableMainTitle(withoutDish, postTitles, context)) {
        const fallbackMain = countCoverUnits(`${keyword}泰餐`) <= MAX_MAIN_TITLE_CHARS ? `${keyword}泰餐` : keyword;
        withoutDish = isAcceptableMainTitle(fallbackMain, postTitles, context) ? fallbackMain : withoutDish;
      }
      nextTitle = withoutDish;
      if (!nextSubtitle.includes(short) && !nextSubtitle.includes(dish)) {
        nextSubtitle = fitSubtitleAroundDish(dish, nextSubtitle);
      }
    }
  }

  if (countCoverUnits(nextSubtitle) > maxSubtitleUnits(nextSubtitle, context)) {
    const dishesInSub = fullNames.filter(
      (name) => nextSubtitle.includes(name) || nextSubtitle.includes(coverDishShortName(name)),
    );
    if (dishesInSub.length > 0) nextSubtitle = fitSubtitleAroundDish(dishesInSub[0], nextSubtitle);
  }

  return { title: prepareCoverLine(nextTitle), subtitle: prepareCoverLine(nextSubtitle) };
}

function customerSaid(context: CoverTitleContext, pattern: RegExp) {
  const blob = [context.diningNote ?? "", ...(context.recommendTo ?? []), ...(context.enjoyMost ?? [])].join("\n");
  return pattern.test(blob);
}

/** A specific readable line stays. Keyword quota and a one-or-two-unit length miss do not reject it. */
function substantiveCoverLine(
  text: string,
  role: "main" | "sub",
  postTitles: string[],
  context: CoverTitleContext,
  mainTitle = "",
) {
  const cleaned = prepareCoverLine(text);
  if (!cleaned) return false;
  if (!isNaturalCoverChinese(cleaned)) return false;
  if (looksIncompleteCover(cleaned)) return false;
  if (FORBIDDEN_COVER_CLAIMS.test(cleaned)) return false;
  if (containsHarshNegative(cleaned)) return false;
  if (/#|📍|⏰|http|www\.|\+\d/.test(cleaned)) return false;
  if (isCoverKeywordStuffing(cleaned)) return false;
  if (isWeakSeoCover(cleaned)) return false;
  if (usesUnselectedCoverLocation(cleaned, context.branch)) return false;
  if (role === "main" && postTitles.some((postTitle) => copiedFromPostTitle(cleaned, postTitle))) return false;
  if (role === "sub") {
    if (looksLikeCoverTemplateSpeak(cleaned)) return false;
    if (GENERIC_SUBTITLE.test(cleaned)) return false;
    if (packsMultipleCoverEvidence(cleaned, context)) return false;
    if (hasIllegalCoverDishShort(cleaned, context.dishes)) return false;
    if (inventsUnsupportedCoverClaim(cleaned, context)) return false;
    if (mainTitle && repeatsMain(mainTitle, cleaned)) return false;
    const verdict = validateSubtitleCandidate(cleaned, context.diningNote ?? "");
    if (!verdict.ok && verdict.reason !== "INVALID_LENGTH") return false;
  }
  return true;
}

function inventedTaste(text: string, context: CoverTitleContext) {
  if (/很香|有点特别/.test(text) && !customerSaid(context, /香/)) return true;
  if (/很满足/.test(text) && !customerSaid(context, /满足/)) return true;
  if (/很好吃|好好吃/.test(text) && !customerSaid(context, /好吃/)) return true;
  return false;
}

function replacementMain(context: CoverTitleContext, currentSubtitle: string) {
  for (const pair of evidenceLedCoverPairs(context)) {
    const title = prepareCoverLine(pair.title);
    if (!title || title === currentSubtitle) continue;
    if (isWeakSeoCover(title) || !isNaturalCoverChinese(title) || looksIncompleteCover(title)) continue;
    if (inventedTaste(title, context)) continue;
    return title;
  }
  return "";
}

function chooseCoverOverlay(
  rawTitle: string,
  rawSubtitle = "",
  postTitles: string[] = [],
  context: CoverTitleContext = {},
) {
  const expanded = applyCoverDishNames(
    prepareCoverLine(rawTitle),
    prepareCoverLine(rawSubtitle),
    postTitles,
    context,
  );
  let title = expanded.title;
  let subtitle = expanded.subtitle;
  if (!title.trim() && !subtitle.trim()) return pickFallbackPair(postTitles, context);

  const repairedTitle = repairIncompleteCoverAction(title, context);
  if (repairedTitle !== title && !substantiveCoverLine(title, "main", postTitles, context)) {
    title = repairedTitle;
  }
  if (!substantiveCoverLine(title, "main", postTitles, context)) {
    const replacement = replacementMain(context, subtitle);
    if (replacement) title = replacement;
  }
  if (!substantiveCoverLine(subtitle, "sub", postTitles, context, title)) {
    const verdict = validateSubtitleCandidate(prepareCoverLine(subtitle), context.diningNote ?? "");
    if (!subtitle.trim() || (verdict.ok === false && verdict.reason !== "INVALID_LENGTH")) {
      const next = selectOneValidSubtitle({ note: context.diningNote, preferred: subtitle });
      if (next && !inventedTaste(next, context)) subtitle = next;
    }
  }
  return { title, subtitle };
}

export function layoutCoverOverlay(
  rawTitle: string,
  rawSubtitle = "",
  postTitles: string[] = [],
  context: CoverTitleContext = {},
) {
  const picked = chooseCoverOverlay(rawTitle, rawSubtitle, postTitles, context);
  if (substantiveCoverLine(picked.subtitle, "sub", postTitles, context, picked.title)) {
    return picked;
  }
  const subtitle = selectOneValidSubtitle({
    note: context.diningNote,
    preferred: picked.subtitle,
  });
  return {
    title: picked.title,
    subtitle: inventedTaste(subtitle, context) ? picked.subtitle : subtitle,
  };
}

export function normalizeCoverTitle(raw: string, postTitles: string[] = [], context: CoverTitleContext = {}) {
  return layoutCoverOverlay(raw, "", postTitles, context).title;
}

export function splitCoverTitle(coverTitle: string, subtitle = "", context: CoverTitleContext = {}) {
  return layoutCoverOverlay(coverTitle, subtitle, [], context);
}
