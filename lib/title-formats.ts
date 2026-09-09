const FLAG = "🇹🇭";
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const EMOJI_ONE = /\p{Extended_Pictographic}/u;
const COLON_RE = /[:：]/;
const FLAG_KEYWORD_COLON_RE = /^🇹🇭\s*\S{2,12}\s*[:：]/;

export type TitleEmojiPlacement = "none" | "flag-only" | "start" | "middle" | "end";

export type TitleFormatAnalysis = {
  startsWithFlag: boolean;
  hasColon: boolean;
  hasNonFlagEmoji: boolean;
  hasVisual: boolean;
  isFlagKeywordColon: boolean;
  emojiPlacement: TitleEmojiPlacement;
  signature: string;
};

function stripFlagPrefix(title: string) {
  return title.replace(/^🇹🇭\s*/, "");
}

function nonFlagEmojiChars(title: string) {
  return stripFlagPrefix(title).match(EMOJI_RE) ?? [];
}

function emojiPlacement(title: string, startsWithFlag: boolean, hasNonFlagEmoji: boolean): TitleEmojiPlacement {
  if (!hasNonFlagEmoji) return startsWithFlag ? "flag-only" : "none";
  const body = stripFlagPrefix(title).trim();
  const chars = [...body];
  const first = chars[0] ?? "";
  const last = chars[chars.length - 1] ?? "";
  if (EMOJI_ONE.test(first) && first !== FLAG) return "start";
  if (EMOJI_ONE.test(last)) return "end";
  return "middle";
}

export function analyzeTitleFormat(title: string): TitleFormatAnalysis {
  const trimmed = title.trim();
  const startsWithFlag = trimmed.startsWith(FLAG);
  const hasColon = COLON_RE.test(trimmed);
  const hasNonFlagEmoji = nonFlagEmojiChars(trimmed).length > 0;
  const placement = emojiPlacement(trimmed, startsWithFlag, hasNonFlagEmoji);
  const punct = COLON_RE.test(trimmed)
    ? "colon"
    : /[｜|]/.test(trimmed)
      ? "pipe"
      : /[！!]/.test(trimmed)
        ? "bang"
        : /[？?]/.test(trimmed)
          ? "question"
          : "plain";
  return {
    startsWithFlag,
    hasColon,
    hasNonFlagEmoji,
    hasVisual: startsWithFlag || hasNonFlagEmoji,
    isFlagKeywordColon: FLAG_KEYWORD_COLON_RE.test(trimmed),
    emojiPlacement: placement,
    signature: [
      startsWithFlag ? "flag" : "noflag",
      hasColon ? "colon" : "nocolon",
      placement,
      punct,
    ].join("+"),
  };
}

function formatSetKey(titles: string[]) {
  return titles.map((title) => analyzeTitleFormat(title).signature).sort().join("||");
}

export function evaluateTitleFormats(titles: string[], previousTitles: string[] = []) {
  const cleaned = titles.map((title) => title.trim()).filter(Boolean);
  const analyses = cleaned.map(analyzeTitleFormat);
  const reasons: string[] = [];

  if (cleaned.length < 3) {
    reasons.push("Need exactly 3 titles with mixed formats.");
    return { ok: false, analyses, reasons };
  }

  const flagCount = analyses.filter((item) => item.startsWithFlag).length;
  const colonCount = analyses.filter((item) => item.hasColon).length;
  const visualCount = analyses.filter((item) => item.hasVisual).length;
  const emojiCount = analyses.filter((item) => item.hasNonFlagEmoji).length;
  const uniqueSignatures = new Set(analyses.map((item) => item.signature));
  const templateCount = analyses.filter((item) => item.isFlagKeywordColon).length;

  if (flagCount === 3) reasons.push("Do not start all 3 titles with 🇹🇭.");
  if (colonCount === 3) reasons.push("Do not put a colon in all 3 titles.");
  if (visualCount === 3) reasons.push("Do not put emoji/flag in all 3 titles.");
  if (visualCount === 0) reasons.push("Do not leave all 3 titles without any emoji or 🇹🇭.");
  if (emojiCount === 3) reasons.push("Do not put a decorative emoji in all 3 titles.");
  if (uniqueSignatures.size < 2) {
    reasons.push("At least 2 titles must use different sentence or punctuation structures.");
  }
  if (templateCount >= 2) {
    reasons.push("Do not use 🇹🇭 + keyword + colon + content as a repeated title template.");
  }

  const previous = previousTitles.map((title) => title.trim()).filter(Boolean);
  if (previous.length >= 3 && formatSetKey(cleaned) === formatSetKey(previous.slice(0, 3))) {
    reasons.push("Do not reuse the same 3 title structures as the previous generation.");
  }

  return { ok: reasons.length === 0, analyses, reasons };
}

function stripNonFlagEmojis(title: string) {
  const flag = title.trimStart().startsWith(FLAG) ? FLAG : "";
  const rest = stripFlagPrefix(title.trim()).replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
  return `${flag}${rest}`;
}

/**
 * Last-resort mix of flag / colon / emoji so the 3 titles are not identical shells.
 * Does not rewrite the wording.
 */
export function ensureTitleFormats(
  titles: [string, string, string],
  previousTitles: string[] = [],
): [string, string, string] {
  const next: [string, string, string] = [titles[0].trim(), titles[1].trim(), titles[2].trim()];

  const allFlag = next.every((title) => title.startsWith(FLAG));
  if (allFlag) {
    next[1] = stripFlagPrefix(next[1]).trim();
    next[2] = stripFlagPrefix(next[2]).trim();
  }

  const allColon = next.every((title) => COLON_RE.test(title));
  if (allColon) {
    next[2] = next[2].replace(COLON_RE, "，");
  }

  const allVisual = next.every((title) => analyzeTitleFormat(title).hasVisual);
  if (allVisual) {
    next[1] = stripNonFlagEmojis(stripFlagPrefix(next[1])).trim();
  }

  const noneVisual = next.every((title) => !analyzeTitleFormat(title).hasVisual);
  if (noneVisual && !next[0].startsWith(FLAG)) {
    next[0] = `${FLAG}${next[0]}`;
  }

  const templateHeavy = next.filter((title) => analyzeTitleFormat(title).isFlagKeywordColon).length >= 2;
  if (templateHeavy) {
    next[1] = stripFlagPrefix(next[1]).replace(COLON_RE, "，").trim();
  }

  const check = evaluateTitleFormats(next, previousTitles);
  if (check.ok) return next;

  if (check.reasons.some((reason) => reason.includes("without any emoji"))) {
    if (!next[0].startsWith(FLAG)) next[0] = `${FLAG}${next[0]}`;
  }

  return next;
}

export function formatTitleFormatRules() {
  return `TITLE FORMAT DIVERSITY — MANDATORY:
Every generation must actively change sentence structure and punctuation. Do NOT give all 3 titles the same shell.

Mix these formats. They are optional tools, not a fixed order:

1) 🇹🇭 FLAG OPENING — some titles may start with 🇹🇭, with or without a colon.
   Examples: 🇹🇭曼谷探店｜这家泰式料理真的太香了 / 🇹🇭曼谷美食推荐，这家可以先收藏 / 🇹🇭来曼谷吃到的泰国菜

2) COLON STRUCTURE — a colon is allowed, but not in every title.
   Examples: 曼谷泰餐：这家料理太香了 / 曼谷美食：隐藏在商场里的泰式餐厅

3) NO COLON, NO FLAG — a natural complete sentence.
   Examples: 曼谷这家泰式料理真的值得专程来吃 / 来曼谷旅游可以先看看这家餐厅

4) ONE NATURAL EMOJI — occasionally 1 emoji at the start, middle, or end. Not every title.
   Examples: 😋曼谷探店！这家泰式料理太香了 / 曼谷美食推荐，这道咖喱蟹真的很可以🍛

For exactly 3 titles:
- Formats must look obviously different.
- NOT all 3 with a colon.
- NOT all 3 starting with 🇹🇭.
- NOT all 3 using emoji/flag.
- NOT all 3 without any emoji/flag.
- At least 2 titles must use different sentence or punctuation structures.
- 🇹🇭, colon, and emoji are optional. Recombine them every generation.
- Do not force emoji, flag, or colon just to look different. Titles must still read like natural Xiaohongshu titles.

FORBIDDEN FIXED TEMPLATE:
Do NOT treat “🇹🇭 + keyword + colon + content” as the default title formula.
Do not make 2 or 3 titles follow that same skeleton with swapped words.
Titles should sound like different people wrote them, not one template filling in blanks.

If previous titles exist, do not repeat that same 3-structure combination.`;
}
