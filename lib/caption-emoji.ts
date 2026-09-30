import { stripGeneratedLocationTime } from "@/lib/locations";

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

/** Shared caption + title emoji list. Cover overlay still has no emoji. */
export const STORY_EMOJI_POOL = [
  "🍛",
  "🦀",
  "🍤",
  "🍚",
  "🍜",
  "🥭",
  "🍋",
  "🌶️",
  "😍",
  "🥹",
  "🤤",
  "🥰",
  "❤️",
  "✨",
  "🇹🇭",
  "👀",
  "🤯",
  "😳",
  "😋",
] as const;

export const MIN_STORY_POOL_EMOJIS = 2;

const FOOD_EMOJI_CUES: Array<[RegExp, (typeof STORY_EMOJI_POOL)[number]]> = [
  [/芒果|mango/i, "🥭"],
  [/柠檬|檸檬|青柠|lemon/i, "🍋"],
  [/蟹/, "🦀"],
  [/虾|蝦/, "🍤"],
  [/冬阴功|冬蔭功/, "🍜"],
  [/咖喱|咖哩/, "🍛"],
  [/糯米饭|炒饭|滑蛋饭|米饭|盖饭/, "🍚"],
  [/辣|辣椒/, "🌶️"],
];

const PLACE_EMOJI_CUES: Array<[RegExp, (typeof STORY_EMOJI_POOL)[number]]> = [
  [/泰国|曼谷|Thai|Bangkok/i, "🇹🇭"],
];

const MOOD_EMOJI_CUES: Array<[RegExp, readonly string[]]> = [
  [/没想到|居然|惊喜|震撼/, ["🤯", "😳"]],
  [/馋|流口水|好香|还想再[吃点]/, ["🤤", "😋"]],
  [/超爱|好喜欢|爱上|心动/, ["😍", "🥰", "❤️"]],
  [/满足|好吃|不错|对胃口|很可以|好喝/, ["😋", "✨"]],
  [/舒服|好看|翻新/, ["✨", "🥰"]],
  [/第一次|有点懵|看菜单/, ["👀", "😳"]],
];

const FALLBACK_MOOD_EMOJIS = ["😋", "✨", "🥰", "😍", "🤤", "👀"] as const;

export function splitCaptionStoryAndLocation(caption: string) {
  const trimmed = caption.trim();
  const story = stripGeneratedLocationTime(trimmed);
  const location = story && trimmed.startsWith(story) ? trimmed.slice(story.length).trim() : "";
  return { story: story || trimmed, location };
}

export function countEmojis(text: string) {
  return text.match(EMOJI_RE)?.length ?? 0;
}

/** Location & Time 📍/⏰ are not part of the story-body emoji count. */
export function countStoryEmojis(caption: string) {
  const { story } = splitCaptionStoryAndLocation(caption);
  return countEmojis(story);
}

function chunkHasMango(text: string) {
  return /芒果|mango/i.test(text);
}

function chunkHasLemon(text: string) {
  return /柠檬|檸檬|青柠|lemon/i.test(text);
}

function fixFruitEmojisInChunk(chunk: string) {
  const mango = chunkHasMango(chunk);
  const lemon = chunkHasLemon(chunk);
  if (mango && !lemon) return chunk.replaceAll("🍋", "🥭");
  if (lemon && !mango) return chunk.replaceAll("🥭", "🍋");
  return chunk;
}

/** 🍋 is lemon only. 🥭 is mango only. */
export function fixFruitEmojis(text: string) {
  const mango = chunkHasMango(text);
  const lemon = chunkHasLemon(text);
  if (mango && !lemon) return text.replaceAll("🍋", "🥭");
  if (lemon && !mango) return text.replaceAll("🥭", "🍋");
  return text.split(/([。！？!?\n])/).map(fixFruitEmojisInChunk).join("");
}

export function fixFruitEmojisInTitles(titles: [string, string, string]): [string, string, string] {
  return titles.map(fixFruitEmojis) as [string, string, string];
}

export function formatCaptionEmojiRules() {
  return `EMOJI — caption story body MUST include at least ${MIN_STORY_POOL_EMOJIS} emojis from the approved list that fit THIS caption. Titles may use the same list. Cover overlay never uses emoji. Location 📍/⏰ do not count.

Approved list only: ${STORY_EMOJI_POOL.join(" ")}
Pick ones that fit the sentence: 蟹→🦀, 虾→🍤, 芒果→🥭, 柠檬/青柠→🍋, 饭→🍚, 冬阴功→🍜, 咖喱→🍛, 辣→🌶️. Mood emoji when there is no food cue. 🇹🇭 only when the sentence is actually about Thailand/Bangkok.
🍋 = lemon / 柠檬 / 青柠 ONLY. Never 🍋 for 芒果 / 芒果糯米饭.
🥭 = mango / 芒果 ONLY. Never 🥭 for lemon / 柠檬.
Do not put an emoji after every sentence. Do not use 🍽️ 📍 🕐 or any emoji outside this list.
Do NOT always use the same pair (🇹🇭😋 or ✨❤️). Change which ${MIN_STORY_POOL_EMOJIS} fit this caption.`;
}

function poolEmojisIn(text: string) {
  const found: string[] = [];
  for (const emoji of STORY_EMOJI_POOL) {
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(emoji, from);
      if (at < 0) break;
      found.push(emoji);
      from = at + emoji.length;
    }
  }
  return found;
}

function splitStoryUnits(story: string) {
  const parts = story.split(/(?<=[。！？!?\n])/u);
  return parts.length > 0 ? parts : [story];
}

function attachEmoji(unit: string, emoji: string) {
  if (!unit.trim() || unit.includes(emoji)) return unit;
  if (/[。！？!?]$/.test(unit)) return unit.replace(/([。！？!?]+)$/, `${emoji}$1`);
  if (/\n$/.test(unit)) return unit.replace(/\n+$/, `${emoji}\n`);
  return `${unit}${emoji}`;
}

function seedFrom(text: string) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function injectFittingStoryEmojis(story: string) {
  if (!story.trim()) return story;
  let count = poolEmojisIn(story).length;
  if (count >= MIN_STORY_POOL_EMOJIS) return story;

  const units = splitStoryUnits(story);
  const reserved = new Set(poolEmojisIn(story));
  const planned: Array<{ index: number; emoji: string }> = [];

  const consider = (index: number, emoji: string) => {
    if (reserved.has(emoji) || planned.length + count >= MIN_STORY_POOL_EMOJIS) return;
    const unit = units[index] ?? "";
    if (!unit.trim() || unit.includes(emoji)) return;
    reserved.add(emoji);
    planned.push({ index, emoji });
  };

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i] ?? "";
    if (!unit.trim()) continue;
    for (const [pattern, emoji] of FOOD_EMOJI_CUES) {
      if (pattern.test(unit)) consider(i, emoji);
    }
  }

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i] ?? "";
    if (!unit.trim()) continue;
    for (const [pattern, emojis] of MOOD_EMOJI_CUES) {
      if (!pattern.test(unit)) continue;
      const pick = emojis.find((emoji) => !reserved.has(emoji));
      if (pick) consider(i, pick);
    }
  }

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i] ?? "";
    if (!unit.trim()) continue;
    for (const [pattern, emoji] of PLACE_EMOJI_CUES) {
      if (pattern.test(unit)) consider(i, emoji);
    }
  }

  const order = units
    .map((_, index) => index)
    .filter((index) => units[index]?.trim())
    .sort((a, b) => {
      const left = STORY_EMOJI_POOL.some((emoji) => units[a]?.includes(emoji)) ? 1 : 0;
      const right = STORY_EMOJI_POOL.some((emoji) => units[b]?.includes(emoji)) ? 1 : 0;
      return left - right;
    });
  const fallbacks = FALLBACK_MOOD_EMOJIS.filter((emoji) => !reserved.has(emoji));
  const seed = seedFrom(story);
  fallbacks.forEach((emoji, offset) => {
    consider(order[(seed + offset) % Math.max(order.length, 1)] ?? 0, emoji);
  });

  if (planned.length === 0) return story;

  const byIndex = new Map<number, string[]>();
  for (const item of planned) {
    const list = byIndex.get(item.index) ?? [];
    list.push(item.emoji);
    byIndex.set(item.index, list);
  }
  return units
    .map((unit, index) => {
      const emojis = byIndex.get(index);
      return emojis ? emojis.reduce((next, emoji) => attachEmoji(next, emoji), unit) : unit;
    })
    .join("");
}

/** Fix fruit mix-ups, then make sure the story body has at least 2 fitting list emojis. */
export function ensureCaptionEmojis(caption: string) {
  const fixed = fixFruitEmojis(caption);
  const { story, location } = splitCaptionStoryAndLocation(fixed);
  const next = injectFittingStoryEmojis(story);
  if (!location) return next;
  return `${next}\n\n${location}`;
}
