import { customerBannedEmoji, STORY_EMOJI_POOL } from "@/lib/caption-emoji";
import type { HumanStyleId } from "@/lib/human-style/library";

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

function seedFrom(text: string) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function foodTitleEmoji(title: string): string {
  const text = stripFlagPrefix(title).replace(EMOJI_RE, "");
  if (/青柠蒸鲈鱼|鲈鱼/.test(text)) return "🐟";
  if (/蟹/.test(text)) return "🦀";
  if (/虾|冬阴功/.test(text)) return "🍤";
  if (/芒果/.test(text)) return "🥭";
  if (/柠檬|檸檬|青柠/.test(text)) return "🍋";
  if (/咖喱/.test(text)) return "🍛";
  if (/炒饭|糯米饭|滑蛋饭/.test(text)) return "🍚";
  if (/辣/.test(text)) return "🌶️";
  return "";
}

const NEGATIVE_TITLE = /一般|有点咸|偏咸|不太|失望|踩雷|难吃|提升空间/;

/** A feeling, scene, or person word in the title itself. Never on a complaint. */
function moodTitleEmoji(title: string): string {
  const text = stripFlagPrefix(title).replace(EMOJI_RE, "");
  if (NEGATIVE_TITLE.test(text)) return "";
  if (/逛|商场|购物/.test(text)) return "🛍️";
  if (/舒服|放松|轻松|安静/.test(text)) return "😌";
  if (/好吃|好喝|下饭|开胃|绝了|很鲜/.test(text)) return "😋";
  if (/香|想吃|馋|再点|续杯|停不下来/.test(text)) return "🤤";
  if (/帅/.test(text)) return "😍";
  if (/喜欢|满意|满足|开心|高兴/.test(text)) return "🥰";
  if (/没想到|居然|竟然|原来|结果|才发现|念叨/.test(text)) return "👀";
  if (/热情|耐心|周到|贴心|服务/.test(text)) return "😊";
  if (/拍照|好看|出片|漂亮/.test(text)) return "✨";
  if (/爸妈|家人|老婆|老公|朋友|同事|一家/.test(text)) return "☺️";
  return "";
}

/** One approved emoji that matches this title: its food first, then its feeling or scene. Empty when nothing matches. */
export function pickTitleEmoji(title: string): string {
  return foodTitleEmoji(title) || moodTitleEmoji(title);
}

const POOL_BASE = new Set<string>(STORY_EMOJI_POOL.map((emoji) => emoji.replace(/\uFE0F/g, "")));

function stripAllVisual(title: string) {
  return stripFlagPrefix(title).replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

function previousTitle1HadVisual(previousTitles: string[]) {
  const previous = previousTitles[0]?.trim() ?? "";
  return previous ? analyzeTitleFormat(previous).hasVisual : false;
}

function previousTitle1HadFlag(previousTitles: string[]) {
  return (previousTitles[0]?.trim() ?? "").startsWith(FLAG);
}

function removeFlags(title: string) {
  return title.replace(/🇹🇭/g, "").replace(/\s{2,}/g, " ").trim();
}

/** About 1 leading flag per 5 titles. A batch of 3 holds at most one, so about 3 in 5 batches get one. */
const LEADING_FLAG_BATCH_CHANCE = 0.6;

function shouldPrefixLeadingFlag() {
  return Math.random() < LEADING_FLAG_BATCH_CHANCE;
}

function applyLeadingFlagFrequency(
  titles: [string, string, string],
  previousTitles: string[],
): [string, string, string] {
  const next = titles.map(removeFlags) as [string, string, string];
  if (!shouldPrefixLeadingFlag()) return next;
  const blocked = previousTitle1HadFlag(previousTitles) ? new Set([0]) : new Set<number>();
  const decorated = next
    .map((title, index) => (analyzeTitleFormat(title).hasNonFlagEmoji ? index : -1))
    .filter((index): index is 0 | 1 | 2 => index >= 0 && !blocked.has(index));
  const open = ([0, 1, 2] as const).filter((index) => !blocked.has(index));
  const pool = decorated.length > 0 ? decorated : open;
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
  if (emojiCount === 3) reasons.push("At least one of the 3 titles stays plain text.");
  if (visualCount === 3) reasons.push("Do not put emoji/flag in all 3 titles.");
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

export type TitleFormatOptions = {
  style?: HumanStyleId;
  note?: string;
  caption?: string;
};

const FOOD_EMOJI = /[🍛🦀🍤🍚🍜🥭🍋🌶️🐟]/u;
const TITLE_ENDS_ON_DISH = /(?:饭|汤|蟹肉|虾仁|河虾|鲈鱼|粉红奶|泰奶|咖喱|牛肉|冬阴功|空心菜)$/;

function stripDecorative(title: string) {
  const flag = title.trimStart().startsWith(FLAG) ? FLAG : "";
  const plain = stripFlagPrefix(title).replace(EMOJI_RE, "").replace(/\uFE0F/g, "").replace(/\s{2,}/g, " ").trim();
  return `${flag}${plain}`.trim();
}

function withDecorative(title: string, emoji: string, atStart: boolean) {
  const flag = title.trimStart().startsWith(FLAG) ? FLAG : "";
  const plain = stripFlagPrefix(title).replace(EMOJI_RE, "").replace(/\uFE0F/g, "").replace(/\s{2,}/g, " ").trim();
  const base = emoji.replace(/\uFE0F/g, "");
  const shown = STORY_EMOJI_POOL.find((item) => item.replace(/\uFE0F/g, "") === base) ?? emoji;
  return atStart && !flag ? `${shown}${plain}` : `${flag}${plain}${shown}`;
}

/** A food emoji must name this title's food. An emoji outside the approved list is swapped or dropped. A fitting feeling emoji stays. */
function alignTitleEmoji(title: string) {
  const current = nonFlagEmojiChars(title)[0] ?? "";
  if (!current) return title;
  const atStart = analyzeTitleFormat(title).emojiPlacement !== "end";
  const swap = (emoji: string) => (emoji ? withDecorative(title, emoji, atStart) : stripDecorative(title));
  if (FOOD_EMOJI.test(current)) {
    const food = foodTitleEmoji(title);
    if (food) return current === food ? title : swap(food);
    return swap(moodTitleEmoji(title));
  }
  if (!POOL_BASE.has(current)) return swap(pickTitleEmoji(title));
  return title;
}

/** Food, or a plain taste or comfort word. Tried before a general feeling or scene. */
function directTitleEmoji(title: string): string {
  const food = foodTitleEmoji(title);
  if (food) return food;
  const text = stripFlagPrefix(title).replace(EMOJI_RE, "");
  if (/舒服|放松/.test(text)) return "😌";
  if (/好吃|好喝/.test(text)) return "😋";
  return "";
}

function choosePlainTitle(
  titles: [string, string, string],
  style: HumanStyleId | undefined,
  blocked: Set<number>,
): 0 | 1 | 2 | null {
  const direct = ([0, 1, 2] as const).filter((index) => directTitleEmoji(titles[index] ?? "") && !blocked.has(index));
  const open =
    direct.length > 0
      ? direct
      : ([0, 1, 2] as const).filter((index) => pickTitleEmoji(titles[index] ?? "") && !blocked.has(index));
  if (open.length === 0) return null;
  if (style === "foodie" || style === "travel") {
    const dish = open.find((index) => /虾|蟹|鱼|饭|芒果|咖喱|冬阴功/.test(titles[index] ?? ""));
    if (dish !== undefined) return dish;
  }
  if (style === "short" || style === "casual" || style === "local") {
    const shortest = [...open].sort((a, b) => (titles[a] ?? "").length - (titles[b] ?? "").length)[0];
    return shortest ?? open[0] ?? null;
  }
  return open[seedFrom(titles.join("|")) % open.length] ?? null;
}

function captionCopiesTitleEmoji(caption: string, emoji: string) {
  const story = caption.replace(/\n*[📍⏰][\s\S]*$/u, "").trim();
  const first = (story.split(/(?<=[。！？!?])/)[0] ?? story).replace(/^🇹🇭/u, "").trim();
  return first.startsWith(emoji);
}

/**
 * Keep the wording. Make sure a normal batch has 1 or 2 title emojis, at the start or the end.
 * A customer ban adds none.
 */
export function ensureTitleFormats(
  titles: [string, string, string],
  previousTitles: string[] = [],
  options: TitleFormatOptions = {},
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

  if (prev1Visual && analyzeTitleFormat(next[0]).hasVisual) {
    next[0] = stripAllVisual(next[0]);
  }

  if (customerBannedEmoji(options.note ?? "")) {
    return next.map((title) => stripDecorative(title)) as [string, string, string];
  }

  for (let index = 0; index < next.length; index += 1) {
    next[index] = alignTitleEmoji(next[index] ?? "");
  }
  const decorated = () =>
    next
      .map((title, index) => ((nonFlagEmojiChars(title).length > 0 ? index : -1)))
      .filter((index): index is 0 | 1 | 2 => index >= 0);
  const tooMany = decorated();
  const extra = tooMany[2];
  if (tooMany.length === 3 && extra !== undefined) next[extra] = stripDecorative(next[extra] ?? "");

  if (decorated().length === 0) {
    const blocked = prev1Visual ? new Set<number>([0]) : new Set<number>();
    const slot = choosePlainTitle(next, options.style, blocked);
    const emoji = slot === null ? "" : directTitleEmoji(next[slot] ?? "") || pickTitleEmoji(next[slot] ?? "");
    if (slot !== null && emoji) {
      const captionEmoji = options.caption?.match(/\p{Extended_Pictographic}/u)?.[0] ?? "";
      const atStart = seedFrom(next.join("|")) % 2 === 0 && captionEmoji !== emoji;
      next[slot] = withDecorative(next[slot] ?? "", emoji, atStart);
    }
  }

  if (decorated().length === 0) {
    const blocked = prev1Visual ? new Set<number>([0]) : new Set<number>();
    const open = ([0, 1, 2] as const).filter(
      (index) => !blocked.has(index) && (next[index] ?? "").trim() && !NEGATIVE_TITLE.test(next[index] ?? ""),
    );
    const slot = [...open].sort((a, b) => (next[a] ?? "").length - (next[b] ?? "").length)[0];
    if (slot !== undefined) next[slot] = withDecorative(next[slot] ?? "", "😊", seedFrom(next.join("|")) % 2 === 1);
  }

  const seenEmoji = new Set<string>();
  for (const index of decorated()) {
    const emoji = nonFlagEmojiChars(next[index] ?? "")[0] ?? "";
    if (!seenEmoji.has(emoji)) {
      seenEmoji.add(emoji);
      continue;
    }
    const alternative = moodTitleEmoji(next[index] ?? "");
    const base = alternative.replace(/\uFE0F/g, "");
    next[index] =
      alternative && !seenEmoji.has(base)
        ? withDecorative(next[index] ?? "", alternative, analyzeTitleFormat(next[index] ?? "").emojiPlacement !== "end")
        : stripDecorative(next[index] ?? "");
    if (alternative) seenEmoji.add(base);
  }

  const placed = decorated();
  if (placed.length >= 2) {
    const first = placed[0];
    const second = placed[1];
    if (
      first !== undefined &&
      second !== undefined &&
      analyzeTitleFormat(next[first] ?? "").emojiPlacement === analyzeTitleFormat(next[second] ?? "").emojiPlacement
    ) {
      const emoji = nonFlagEmojiChars(next[second] ?? "")[0] ?? "";
      if (emoji) next[second] = withDecorative(next[second] ?? "", emoji, analyzeTitleFormat(next[second] ?? "").emojiPlacement !== "start");
    }
  }
  for (const index of decorated()) {
    const title = next[index] ?? "";
    const emoji = nonFlagEmojiChars(title)[0] ?? "";
    if (analyzeTitleFormat(title).emojiPlacement === "end" && TITLE_ENDS_ON_DISH.test(stripDecorative(title))) {
      next[index] = withDecorative(title, emoji, true);
    }
  }

  const lead = next.findIndex((title, index) => {
    const emoji = nonFlagEmojiChars(title)[0] ?? "";
    return emoji && captionCopiesTitleEmoji(options.caption ?? "", emoji) && analyzeTitleFormat(title).emojiPlacement === "start" && index >= 0;
  });
  if (lead >= 0 && !TITLE_ENDS_ON_DISH.test(stripDecorative(next[lead] ?? ""))) {
    const emoji = nonFlagEmojiChars(next[lead] ?? "")[0] ?? "";
    if (emoji) next[lead] = withDecorative(next[lead] ?? "", emoji, false);
  }

  return applyLeadingFlagFrequency(next, previousTitles);
}

/** `poolInEmojiRules: true` points at the EMOJI block's approved list instead of printing it twice. */
export function formatTitleFormatRules(options: { poolInEmojiRules?: boolean } = {}) {
  const pool = options.poolInEmojiRules ? " the approved list in EMOJI." : `: ${STORY_EMOJI_POOL.join(" ")}`;
  return `TITLE FORMAT — the 3 titles must look different. At least one is plain text. At least one of the 3 has a single emoji from${pool}
Usually one or two titles have one each. Do not leave all 3 without an emoji, and do not put one on all 3. Match the food: 蟹→🦀, 虾/冬阴功→🍤, 芒果→🥭, 柠檬/青柠→🍋, 青柠蒸鲈鱼/鲈鱼→🐟, 炒饭/糯米饭→🍚, 咖喱→🍛. No emoji outside this list, and no emoji that names a different food. Place it by THIS ROUND HUMAN STYLE, at the start or the end, not after the dish name, and not in the same spot as the caption. Do not use the same emoji position on every title that has one. No comma, ｜, or colon that adds a second selling point.
If the customer said 不要表情 / 不要 emoji / 无表情, add no title emoji. That request overrides the batch minimum.
🇹🇭 appears about 1 in 5 titles, first character only, on at most one title in a batch. Never 🇹🇭 in the middle or at the end, and never 🇹🇭 + keyword + ｜.
If the previous title 1 had a decorative emoji, this title 1 is plain. Do not copy the previous 3-structure.`;
}
