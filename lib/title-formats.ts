import { STORY_EMOJI_POOL } from "@/lib/caption-emoji";

const FLAG = "🇹🇭";
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const EMOJI_ONE = /\p{Extended_Pictographic}/u;
const COLON_RE = /[:：]/;
const FLAG_KEYWORD_COLON_RE = /^🇹🇭\s*\S{2,12}\s*[:：]/;
const MOOD_EMOJIS = ["😋", "😍", "🥰", "✨", "❤️", "🤤", "🥹", "👀", "😳", "🤯"] as const;

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

function seedFrom(text: string) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

/** Pick one approved emoji that matches the title. 🇹🇭 is never a decorative title emoji. */
export function pickTitleEmoji(title: string): string {
  const text = stripFlagPrefix(title).replace(/🇹🇭/g, "");
  if (/芒果/.test(text)) return "🥭";
  if (/柠檬|檸檬|青柠/.test(text)) return "🍋";
  if (/蟹/.test(text)) return "🦀";
  if (/虾/.test(text)) return "🍤";
  if (/冬阴功|汤/.test(text)) return "🍜";
  if (/咖喱/.test(text)) return "🍛";
  if (/饭/.test(text)) return "🍚";
  if (/辣/.test(text)) return "🌶️";
  return MOOD_EMOJIS[seedFrom(text) % MOOD_EMOJIS.length] ?? "😋";
}

function stripNonFlagEmojis(title: string) {
  const flag = title.trimStart().startsWith(FLAG) ? FLAG : "";
  const rest = stripFlagPrefix(title.trim()).replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
  return `${flag}${rest}`;
}

function stripAllVisual(title: string) {
  return stripFlagPrefix(title).replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

function attachTitleVisual(title: string, kind: "flag" | "pool") {
  const rest = stripAllVisual(title);
  if (!rest) return title;
  if (kind === "flag") return `${FLAG}${rest}`;
  return `${rest}${pickTitleEmoji(rest)}`;
}

function previousTitle1HadVisual(previousTitles: string[]) {
  const previous = previousTitles[0]?.trim() ?? "";
  return previous ? analyzeTitleFormat(previous).hasVisual : false;
}

function previousTitle1HadFlag(previousTitles: string[]) {
  return (previousTitles[0]?.trim() ?? "").startsWith(FLAG);
}

function nextVisualIndex(previousTitles: string[], titles: string[]): 0 | 1 | 2 {
  if (previousTitle1HadVisual(previousTitles)) return 1;
  return seedFrom(titles.join("") || previousTitles.join("") || "title") % 2 === 0 ? 0 : 2;
}

function nextVisualKind(): "pool" {
  return "pool";
}

function removeFlags(title: string) {
  return title.replace(/🇹🇭/g, "").replace(/\s{2,}/g, " ").trim();
}

/** About 1 leading flag per 10 titles: at most one title in a batch of 3, and not after a batch that already had one. */
function shouldPrefixLeadingFlag(previousTitles: string[]) {
  const previous = previousTitles.map((title) => title.trim()).filter(Boolean);
  if (previous.some((title) => title.startsWith(FLAG))) return false;
  const chance = previous.length === 0 ? 0.3 : 0.5;
  return Math.random() < chance;
}

function applyLeadingFlagFrequency(
  titles: [string, string, string],
  previousTitles: string[],
): [string, string, string] {
  const next = titles.map(removeFlags) as [string, string, string];
  if (!shouldPrefixLeadingFlag(previousTitles)) return next;
  const decorated = next
    .map((title, index) => (analyzeTitleFormat(title).hasNonFlagEmoji ? index : -1))
    .filter((index): index is 0 | 1 | 2 => index >= 0);
  const pool = decorated.length > 0 ? decorated : ([0, 1, 2] as const);
  const slot = pool[Math.floor(Math.random() * pool.length)] ?? 1;
  if (!next[slot]) return next;
  next[slot] = `${FLAG}${next[slot]}`;
  return next;
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
  const misplacedFlag = cleaned.filter((title) => title.includes(FLAG) && !title.startsWith(FLAG)).length;
  const multiFlag = cleaned.filter((title) => title.split(FLAG).length > 2).length;
  const colonCount = analyses.filter((item) => item.hasColon).length;
  const visualCount = analyses.filter((item) => item.hasVisual).length;
  const emojiCount = analyses.filter((item) => item.hasNonFlagEmoji).length;
  const uniqueSignatures = new Set(analyses.map((item) => item.signature));
  const templateCount = analyses.filter((item) => item.isFlagKeywordColon).length;

  if (flagCount > 1) reasons.push("At most one of the 3 titles may start with 🇹🇭.");
  if (misplacedFlag > 0) reasons.push("🇹🇭 may only be the first character of a title.");
  if (multiFlag > 0) reasons.push("A title may contain at most one 🇹🇭.");
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
  if (previousTitle1HadVisual(previousTitles) && analyses[0]?.hasVisual) {
    reasons.push("Do not put emoji/flag on title 1 in consecutive generations. Leave title 1 plain this round.");
  }
  if (previousTitle1HadFlag(previousTitles) && analyses[0]?.startsWithFlag) {
    reasons.push("Do not start title 1 with 🇹🇭 again. Previous title 1 already used 🇹🇭.");
  }

  const previous = previousTitles.map((title) => title.trim()).filter(Boolean);
  if (previous.length >= 3 && formatSetKey(cleaned) === formatSetKey(previous.slice(0, 3))) {
    reasons.push("Do not reuse the same 3 title structures as the previous generation.");
  }

  return { ok: reasons.length === 0, analyses, reasons };
}

/**
 * Mix flag / pool emoji / plain titles. Title 1 is not reserved for 🇹🇭.
 * Does not rewrite the wording.
 */
export function ensureTitleFormats(
  titles: [string, string, string],
  previousTitles: string[] = [],
): [string, string, string] {
  const next: [string, string, string] = [
    removeFlags(titles[0]),
    removeFlags(titles[1]),
    removeFlags(titles[2]),
  ];
  const prev1Visual = previousTitle1HadVisual(previousTitles);
  const prev1Flag = previousTitle1HadFlag(previousTitles);

  if (prev1Flag && next[0].startsWith(FLAG)) {
    next[0] = stripFlagPrefix(next[0]).trim();
  }
  if (prev1Visual && analyzeTitleFormat(next[0]).hasVisual) {
    next[0] = stripAllVisual(next[0]);
  }

  const allFlag = next.every((title) => title.startsWith(FLAG));
  if (allFlag) {
    next[1] = stripFlagPrefix(next[1]).trim();
    next[2] = stripFlagPrefix(next[2]).trim();
    if (prev1Flag) next[0] = stripFlagPrefix(next[0]).trim();
  }

  const allColon = next.every((title) => COLON_RE.test(title));
  if (allColon) {
    next[2] = next[2].replace(COLON_RE, "，");
  }

  const allVisual = next.every((title) => analyzeTitleFormat(title).hasVisual);
  if (allVisual) {
    next[1] = stripAllVisual(next[1]);
    if (prev1Visual) next[0] = stripAllVisual(next[0]);
  }

  if (next.every((title) => !analyzeTitleFormat(title).hasVisual)) {
    const slot = nextVisualIndex(previousTitles, next);
    next[slot] = attachTitleVisual(next[slot], nextVisualKind());
  }

  if (prev1Visual && analyzeTitleFormat(next[0]).hasVisual) {
    next[0] = stripAllVisual(next[0]);
    if (next.every((title) => !analyzeTitleFormat(title).hasVisual)) {
      next[1] = attachTitleVisual(next[1], "pool");
    }
  }

  const check = evaluateTitleFormats(next, previousTitles);
  if (check.ok) return applyLeadingFlagFrequency(next, previousTitles);

  if (check.reasons.some((reason) => reason.includes("without any emoji"))) {
    const slot = prev1Visual ? 1 : nextVisualIndex(previousTitles, next);
    if (!analyzeTitleFormat(next[slot]).hasVisual) {
      next[slot] = attachTitleVisual(next[slot], "pool");
    }
  }

  return applyLeadingFlagFrequency(next, previousTitles);
}

export function formatTitleFormatRules() {
  const pool = STORY_EMOJI_POOL.join(" ");
  return `TITLE FORMAT — the 3 titles must look different. At least one is plain text. At least one has exactly one emoji from: ${pool}
Match the food: 蟹→🦀, 虾→🍤, 芒果→🥭, 柠檬/青柠→🍋, 饭→🍚, 冬阴功→🍜, 咖喱→🍛. No emoji outside this list. No comma, ｜, or colon that adds a second selling point.
🇹🇭 is rare, about 1 in 10 titles, first character only, on at most one title in a batch. Most batches have none. Never 🇹🇭 in the middle or at the end, and never 🇹🇭 + keyword + ｜.
If the previous title 1 had a decorative emoji, this title 1 is plain. Do not copy the previous 3-structure.`;
}
