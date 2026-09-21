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

/** Pick one approved emoji that matches the title. 🇹🇭 is only one option, never the default. */
export function pickTitleEmoji(title: string): string {
  const text = stripFlagPrefix(title);
  if (/芒果/.test(text)) return "🥭";
  if (/柠檬|檸檬|青柠/.test(text)) return "🍋";
  if (/蟹/.test(text)) return "🦀";
  if (/虾/.test(text)) return "🍤";
  if (/冬阴功|汤/.test(text)) return "🍜";
  if (/咖喱/.test(text)) return "🍛";
  if (/饭/.test(text)) return "🍚";
  if (/辣/.test(text)) return "🌶️";
  if (/曼谷|泰餐|泰国/.test(text) && seedFrom(text) % 5 === 0) return FLAG;
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

function nextVisualKind(previousTitles: string[]): "flag" | "pool" {
  if (previousTitle1HadFlag(previousTitles)) return "pool";
  if (previousTitles.some((title) => title.trim().startsWith(FLAG))) return "pool";
  return seedFrom(previousTitles.join("") || "emoji") % 3 === 0 ? "flag" : "pool";
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
  const next: [string, string, string] = [titles[0].trim(), titles[1].trim(), titles[2].trim()];
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
    next[slot] = attachTitleVisual(next[slot], nextVisualKind(previousTitles));
  }

  if (prev1Visual && analyzeTitleFormat(next[0]).hasVisual) {
    next[0] = stripAllVisual(next[0]);
    if (next.every((title) => !analyzeTitleFormat(title).hasVisual)) {
      next[1] = attachTitleVisual(next[1], "pool");
    }
  }

  const check = evaluateTitleFormats(next, previousTitles);
  if (check.ok) return next;

  if (check.reasons.some((reason) => reason.includes("without any emoji"))) {
    const slot = prev1Visual ? 1 : nextVisualIndex(previousTitles, next);
    if (!analyzeTitleFormat(next[slot]).hasVisual) {
      next[slot] = attachTitleVisual(next[slot], "pool");
    }
  }

  return next;
}

export function formatTitleFormatRules() {
  const pool = STORY_EMOJI_POOL.join(" ");
  return `TITLE FORMAT DIVERSITY — MANDATORY:
Every generation must actively change sentence structure, punctuation, AND emoji. Do NOT give all 3 titles the same shell.

Title 1 is NOT reserved for 🇹🇭. Do not start title 1 with 🇹🇭 every time.
If the previous title 1 started with 🇹🇭 or had any emoji, this round title 1 must have NO emoji and NO 🇹🇭.
Some generations title 1 has an emoji; some generations title 1 is plain text. Alternate.

When a title uses an emoji, pick exactly 1 from this list that fits the sentence:
${pool}
Match the food when the title names it: 蟹→🦀, 虾→🍤, 芒果→🥭, 柠檬/青柠→🍋, 饭→🍚, 冬阴功/汤→🍜, 咖喱→🍛.
Mood emojis (😋 😍 🥰 ✨ ❤️ 🤤 🥹 👀 😳 🤯) are fine when there is no food cue.
🇹🇭 is only one option in that list — never the default, never glued onto title 1 as a template.
Do not use 🍽️ 📍 🕐 or any emoji outside this list.

Mix these formats. They are optional tools, not a fixed order:

1) PLAIN SENTENCE — no emoji, no 🇹🇭. At least one of the 3 titles must be plain.
   Examples: 曼谷这家泰式料理真的值得专程来吃 / 来曼谷旅游可以先看看这家餐厅

2) ONE POOL EMOJI — 1 emoji at the start or end, chosen from the list above.
   Examples: 曼谷探店，这道咖喱蟹真的很可以🦀 / 😋曼谷这家泰餐吃得好满足

3) 🇹🇭 FLAG — allowed on title 2 or 3, or on title 1 only if the previous title 1 did NOT use 🇹🇭.
   Examples: 🇹🇭曼谷探店｜这家泰式料理真的太香了 / 来曼谷吃到的泰国菜🇹🇭

4) COLON STRUCTURE — a colon is allowed, but not in every title.
   Examples: 曼谷泰餐：这家料理太香了 / 曼谷美食：隐藏在商场里的泰式餐厅

For exactly 3 titles:
- Formats must look obviously different.
- NOT all 3 with a colon.
- NOT all 3 starting with 🇹🇭.
- NOT all 3 using emoji/flag.
- NOT all 3 without any emoji/flag.
- At least 1 title has an emoji or 🇹🇭; at least 1 title has none.
- 🇹🇭, colon, and emoji are optional. Recombine them every generation.
- Do not force 🇹🇭 onto title 1 just to look like a Xiaohongshu title.

FORBIDDEN FIXED TEMPLATE:
Do NOT treat “🇹🇭 + keyword + colon + content” as the default title formula.
Do not make title 1 always start with 🇹🇭.
Do not make 2 or 3 titles follow that same skeleton with swapped words.

If previous titles exist, do not repeat that same 3-structure combination, and do not copy title 1's emoji/flag pattern.`;
}
