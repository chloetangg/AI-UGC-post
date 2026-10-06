import { arrangeDiningStory } from "@/lib/caption-story";
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
  "😌",
  "😆",
  "☺️",
  "😊",
  "🛍️",
  "🐟",
] as const;

export const MIN_STORY_POOL_EMOJIS = 2;

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
  return titles.map((title) => bindEmojis(fixFruitEmojis(title))) as [string, string, string];
}

export function formatCaptionEmojiRules() {
  return `EMOJI — use one only when this sentence has a matching food or feeling. Titles may use the same list. Cover overlay never uses emoji. Location 📍/⏰ do not count, and do not add an emoji just to reach a number.

Approved list only: ${STORY_EMOJI_POOL.join(" ")}
Food sits on that food: 蟹→🦀, 虾→🍤, 芒果→🥭, 柠檬→🍋, 青柠蒸鲈鱼/鲈鱼→🐟, 饭→🍚, 冬阴功→🍜, 咖喱→🍛. 逛街/购物→🛍️.
Feeling, only when the sentence has no food emoji: 好吃/好喝→😋, 香/还想吃→🤤, 帅→😍, 舒服/放松→😌.
🍋 is 柠檬 only. 🥭 is 芒果 only. 🐟 is fish only. Never put 🥭 or 🍋 on 鲈鱼.
The emoji comes immediately after its object. 芒果糯米饭🥭很好吃. 青柠蒸鲈鱼🐟很开胃. Never 鲈鱼很开胃🥭. In one sentence, each food gets its own emoji. No suitable emoji → write none. Do not reuse the previous food's emoji.
Never put Chinese punctuation directly after an emoji. BAD: 很好吃😋。 / 环境很好😌， / 好好吃😋！ GOOD: 好好吃😋 / 芒果糯米饭🥭甜度刚刚好。 The period in the good example is not next to the emoji.
Do not put an emoji on every sentence. Do not stack two emojis together. Do not use 🍽️ 📍 🕐 or any emoji outside this list.`;
}

function splitStoryUnits(story: string) {
  const parts = story.split(/(?<=[。！？!?\n])/u);
  return parts.length > 0 ? parts : [story];
}

const EMOJI_CLUSTER = "\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*";

/** A sentence may end on an emoji. It must not end on emoji + 。 */
export function withSentenceEnd(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (new RegExp(`${EMOJI_CLUSTER}$`, "u").test(trimmed)) return trimmed;
  if (/[。！？!?.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}。`;
}

function tidyEmojiPunctuation(text: string) {
  let next = text.replace(new RegExp(`(${EMOJI_CLUSTER})\\s*[。．.，,！!？?；;]+`, "gu"), "$1 ");
  next = next.replace(new RegExp(`[。．.，,！!？?]\\s*(${EMOJI_CLUSTER})(?=\\s*$)`, "gu"), "$1");
  next = next.replace(new RegExp(`(${EMOJI_CLUSTER})(?:\\s*${EMOJI_CLUSTER})+`, "gu"), "$1");
  return next.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, "");
}

function stripAiConnectives(text: string) {
  return text
    .replace(/值得一提的是[，,]?/g, "")
    .replace(/不得不说[，,]?/g, "")
    .replace(/总体来说[，,]?/g, "")
    .replace(/总的来说[，,]?/g, "")
    .replace(/整体来说[，,]?/g, "")
    .replace(/作为一家/g, "")
    .replace(/如果你正在寻找/g, "")
    .replace(/给我的感觉是[，,]?/g, "")
    .replace(/对于喜欢[^。！？]{0,12}的人来说[，,]?/g, "")
    .replace(/非常值得推荐[。！？]?/g, "")
    .replace(/这次来到/g, "这次去了");
}

const OBJECT_EMOJIS: Array<{ re: RegExp; emoji: string }> = [
  { re: /^青柠蒸鲈鱼/, emoji: "🐟" },
  { re: /^酸甜酱炒河虾|^河虾冬阴功汤|^冬阴功|^河虾/, emoji: "🍤" },
  { re: /^芒果糯米饭|^芒果/, emoji: "🥭" },
  { re: /^蒜炒虾仁|^虾仁/, emoji: "🍤" },
  { re: /^咖喱蟹肉/, emoji: "🦀" },
  { re: /^青咖喱牛肉|^咖喱/, emoji: "🍛" },
  { re: /^菠萝炒饭|^滑蛋饭|^炒饭|^糯米饭/, emoji: "🍚" },
  { re: /^柠檬茶|^柠檬|^青柠/, emoji: "🍋" },
  { re: /^鲈鱼/, emoji: "🐟" },
  { re: /^蟹/, emoji: "🦀" },
  { re: /^虾/, emoji: "🍤" },
  { re: /^逛完|^逛街|^购物/, emoji: "🛍️" },
];

const MOOD_EMOJIS: Array<{ re: RegExp; emoji: string }> = [
  { re: /^(?:真的)?很?好喝|^(?:真的)?很?好吃/, emoji: "😋" },
  { re: /^(?:真的)?很?帅/, emoji: "😍" },
  { re: /^(?:真的)?很?舒服|^放松/, emoji: "😌" },
];

function longestMatch(text: string, rows: Array<{ re: RegExp; emoji: string }>) {
  let best: { len: number; emoji: string } | null = null;
  for (const row of rows) {
    const match = text.match(row.re);
    if (!match || match.index !== 0) continue;
    if (!best || match[0].length > best.len) best = { len: match[0].length, emoji: row.emoji };
  }
  return best;
}

/** Put each emoji directly after its object. Drop an emoji that belongs to something else. */
export function bindEmojis(sentence: string) {
  const ending = sentence.match(/[。！？!?]+$/)?.[0] ?? "";
  const plain = sentence.replace(/\p{Extended_Pictographic}/gu, "").replace(/[。！？!?]+$/g, "");
  let result = "";
  let i = 0;
  let placedFood = false;
  const placed = new Set<string>();
  while (i < plain.length) {
    const found = longestMatch(plain.slice(i), OBJECT_EMOJIS);
    if (found) {
      result += plain.slice(i, i + found.len);
      if (!placed.has(found.emoji)) {
        result += found.emoji;
        placed.add(found.emoji);
      }
      placedFood = true;
      i += found.len;
      continue;
    }
    result += plain[i];
    i += 1;
  }
  if (!placedFood) {
    let moodded = false;
    let next = "";
    let j = 0;
    while (j < result.length) {
      const found = !moodded ? longestMatch(result.slice(j), MOOD_EMOJIS) : null;
      if (found) {
        next += result.slice(j, j + found.len) + found.emoji;
        moodded = true;
        j += found.len;
        continue;
      }
      next += result[j];
      j += 1;
    }
    result = next;
  }
  return tidyEmojiPunctuation(`${result}${ending}`);
}

function joinCaptionSentences(sentences: string[]) {
  return sentences.map((sentence) => withSentenceEnd(tidyEmojiPunctuation(sentence))).reduce((text, sentence) => {
    if (!text) return sentence;
    if (new RegExp(`${EMOJI_CLUSTER}$`, "u").test(text)) return `${text} ${sentence}`;
    return `${text}${sentence}`;
  }, "");
}

function injectFittingStoryEmojis(story: string) {
  if (!story.trim()) return story;
  return splitStoryUnits(story)
    .map((unit) => (unit.trim() ? bindEmojis(unit) : unit))
    .reduce((text, unit) => {
      if (!text) return unit;
      if (/\p{Extended_Pictographic}$/u.test(text) && /\p{Script=Han}/u.test(unit.trim())) return `${text} ${unit.trim()}`;
      return text + unit;
    }, "");
}

const FOOD_SUBJECT =
  /芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|酸甜酱炒河虾|粉红奶/;

function foodSubject(sentence: string) {
  return sentence.match(FOOD_SUBJECT)?.[0] ?? "";
}

function captionBucket(sentence: string) {
  const text = sentence.replace(/\p{Extended_Pictographic}/gu, "");
  const food = FOOD_SUBJECT.test(text) || /好吃|好喝|味道|粉红奶|芒果|糯米|虾|蟹|咖喱|冬阴功|柠檬|这道|点的|甜度|粘度|口感|配料|锅气/.test(text);
  const service = /服务|老板|店员|服务员/.test(text);
  const scene = /环境|氛围|舒服|放松|空间|翻新|坐着|坐下来|centralwOrld|商场|逛街|Baan\s*Ying|方便|楼/i.test(text);
  if (food && /粉红奶|芒果|糯米|虾|蟹|咖喱|冬阴功|柠檬|这道|点的|甜度|粘度|口感|好吃|好喝/.test(text)) return "food";
  if (service && !food) return "service";
  if (scene) return "scene";
  if (food) return "food";
  if (service) return "service";
  return "other";
}

/** Long captions break between topic groups, at most about 3 sentences each. */
export function groupCaptionParagraphs(story: string) {
  if (/\n\n/.test(story)) {
    return story
      .split(/\n\n+/)
      .map((paragraph) => joinCaptionSentences(paragraph.split(/(?<=[。！？!?])/u).map((part) => part.trim()).filter(Boolean)))
      .filter(Boolean)
      .join("\n\n");
  }
  const sentences = story
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[。！？!?])/u))
    .map((part) => part.trim())
    .filter(Boolean);
  const plainLength = (value: string) => value.replace(/\p{Extended_Pictographic}/gu, "").replace(/[。！？!?\s，,]/g, "").length;
  const groups: string[][] = [];
  for (const sentence of sentences) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    const previousSubject = previous ? foodSubject(previous) : "";
    const subject = foodSubject(sentence);
    const dishChanged = Boolean(previousSubject && subject && previousSubject !== subject);
    const drinkFollowsFood = Boolean(previousSubject && subject === "粉红奶" && !/冬阴功|炒饭|蟹|虾仁|咖喱|糯米/.test(sentence));
    const detailed = plainLength(previous ?? "") >= 18 || plainLength(sentence) >= 18;
    if (
      current &&
      previous &&
      captionBucket(previous) === captionBucket(sentence) &&
      current.length < 3 &&
      (!dishChanged || !detailed || drinkFollowsFood)
    ) {
      current.push(sentence);
    } else groups.push([sentence]);
  }
  const severalDishes = new Set(sentences.map(foodSubject).filter(Boolean)).size > 1;
  const mixedTopics = new Set(sentences.map(captionBucket)).size > 1;
  if (groups.length > 1 && groups.every((group) => group.length === 1) && !mixedTopics && !severalDishes) {
    if (sentences.length <= 3) return joinCaptionSentences(sentences);
    const packed: string[][] = [];
    let index = 0;
    while (index < sentences.length) {
      const rest = sentences.length - index;
      const size = rest > 3 ? (rest % 3 === 1 ? 2 : 3) : rest;
      packed.push(sentences.slice(index, index + size));
      index += size;
    }
    return packed.map((group) => joinCaptionSentences(group)).join("\n\n");
  }
  const paragraphs = groups.flatMap((group) => {
    if (group.length <= 3) return [group];
    const chunks: string[][] = [];
    let index = 0;
    while (index < group.length) {
      const rest = group.length - index;
      const size = rest === 4 ? 2 : Math.min(3, rest);
      chunks.push(group.slice(index, index + size));
      index += size;
    }
    return chunks;
  });
  return paragraphs.map((group) => joinCaptionSentences(group)).join("\n\n");
}

/** Fix fruit mix-ups and emoji punctuation. Add a fitting emoji only where the sentence already has that meaning. */
export function ensureCaptionEmojis(caption: string) {
  const fixed = stripAiConnectives(fixFruitEmojis(caption));
  const { story, location } = splitCaptionStoryAndLocation(fixed);
  const next = groupCaptionParagraphs(injectFittingStoryEmojis(arrangeDiningStory(story)));
  if (!location) return next;
  return `${next}\n\n${location}`;
}
