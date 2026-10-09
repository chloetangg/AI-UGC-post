import type { HumanStyleSelection } from "@/lib/human-style/select";
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
  if (/鲈鱼/.test(chunk)) return chunk.replace(/🥭|🍋/g, "🐟");
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
  return titles.map((title) => settleTitleEmoji(fixFruitEmojis(title))) as [string, string, string];
}

/** Keep a title emoji the model already wrote. Move one that sits between Chinese words to the start or the end. */
function settleTitleEmoji(title: string) {
  const trimmed = title.replace(/\s{2,}/g, " ").trim();
  const flag = trimmed.startsWith("🇹🇭") ? "🇹🇭" : "";
  const body = trimmed.replace(/🇹🇭/g, "");
  const emojis = body.match(/\p{Extended_Pictographic}\uFE0F?/gu) ?? [];
  if (emojis.length === 0) return `${flag}${body.replace(/\s{2,}/g, " ").trim()}`.trim();
  const decorative = emojis[0] ?? "";
  const plain = body.replace(/\p{Extended_Pictographic}\uFE0F?/gu, "").replace(/\s{2,}/g, " ").trim();
  const compact = body.replace(/\s/g, "");
  const atStart = compact.startsWith(decorative);
  const atEnd = compact.endsWith(decorative);
  if (emojis.length === 1 && (atStart || atEnd) && !(atStart && atEnd && plain.length > 0)) {
    return trimmed;
  }
  let hash = 0;
  for (const char of plain) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const atFront = hash % 2 === 0;
  return atFront ? `${flag}${decorative}${plain}` : `${flag}${plain}${decorative}`;
}

export function customerBannedEmoji(note = "") {
  return /不要(?:加)?(?:表情|emoji)|无表情/i.test(note);
}

export function formatCaptionEmojiRules() {
  return `EMOJI — follow THIS ROUND HUMAN STYLE. Do not pick a count first and then fill it in. Titles use the same approved list, but title placement is a separate rule.

Approved list only: ${STORY_EMOJI_POOL.join(" ")}
Match the meaning of THIS sentence: 蟹→🦀, 虾/河虾冬阴功汤→🍤, 芒果→🥭, 柠檬→🍋, 青柠蒸鲈鱼/鲈鱼→🐟, 炒饭/糯米饭→🍚, 冬阴功→🍤, 咖喱→🍛. 逛街/购物→🛍️. Feeling, only in a sentence that is not already a food line: 好吃/好喝→😋, 香/还想吃→🤤, 帅→😍, 舒服/放松→😌.
🍋 is 柠檬 only. 🥭 is 芒果 only. 🐟 is fish only. Never put 🥭 or 🍋 on 鲈鱼, and never put 🐟 on a later sentence about 安心 just because fish was mentioned earlier.
Body: Foodie stays with texture or taste, not one emoji per dish. Chatty sits in an aside or an exclamation, unevenly. Casual uses one, with a feeling or at a sentence end. Story marks a turn, not every beat. Short uses one only at the real point. Playful can place one, and occasionally a pair, with the loose tone. Travel stays with a real place or scene. Local is sparse: one natural spot, not a guide sticker. Emotional follows how strong the customer's own feeling already is.
These are habits, not a fixed position for that persona. Do not put one on every sentence or every dish. Do not glue one to every dish name. Do not add an unrelated emoji to look human. If the caption already has a natural emoji, do not add another pass of them. Local and Short may use very few, but do not leave the whole caption without one just because it is short or quiet, unless the customer said 不要表情 / 不要 emoji / 无表情.
There is no body emoji quota and no body emoji cap. That is not permission to stack them.
Place them differently: sentence start, sentence end, after the reaction, or inside the sentence when that reads naturally.
Titles, separately: at least one of the 3 titles has an emoji. Usually one or two titles have one each. Start or end, not glued to the dish name, and not a copy of the caption placement. Do not leave all 3 titles bare just because the caption is sparse. A customer ban overrides this title minimum. Do not repeat one placement on every title.
Never put Chinese punctuation directly after an emoji. BAD: 很好吃😋。 GOOD: 好好吃😋
Do not use 🍽️ 📍 🕐 or any emoji outside this list. Cover overlay still has no emoji.`;
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

function tidyEmojiPunctuation(text: string, keepClusters = false) {
  let next = text.replace(new RegExp(`(${EMOJI_CLUSTER})\\s*[。．.，,！!？?；;]+`, "gu"), "$1 ");
  if (!keepClusters) {
    next = next.replace(new RegExp(`(${EMOJI_CLUSTER})(?:\\s*${EMOJI_CLUSTER})+`, "gu"), "$1");
  }
  return next.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, "");
}

/** An emoji with no words is not a sentence. Attach it to the previous sentence and keep that sentence's punctuation. */
function attachOrphanEmoji(text: string) {
  const paragraphs = text.split(/\n\n/).reduce<string[]>((blocks, paragraph) => {
    const next = paragraph
      .split(/(?<=[。！？!?])/)
      .reduce((sentence, part) => {
        const words = part.replace(/[\s。！？!?\p{Extended_Pictographic}]/gu, "");
        if (words.length > 0) return sentence + part;
        const emoji = part.replace(/[。！？!?\s]/g, "");
        if (!emoji || !sentence) return sentence;
        return `${sentence.replace(/\s+$/u, "")}${emoji}`;
      }, "");
    if (!next.trim()) return blocks;
    if (/^[\s\p{Extended_Pictographic}。！？!?]+$/u.test(next) && blocks.length > 0) {
      const emoji = next.replace(/[。！？!?\s]/g, "");
      blocks[blocks.length - 1] = `${blocks[blocks.length - 1].replace(/\s+$/u, "")}${emoji}`;
      return blocks;
    }
    blocks.push(next);
    return blocks;
  }, []);
  return paragraphs.join("\n\n");
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

const DISH_GLUE =
  /(青柠蒸鲈鱼|河虾冬阴功汤|酸甜酱炒河虾|芒果糯米饭|菠萝炒饭|滑蛋饭|冬阴功|鲈鱼|咖喱|炒饭|蟹|虾)(\p{Extended_Pictographic}\uFE0F?)/u;

/** Move an emoji that sits inside a sentence, or directly on a dish name, to the start or the end of that same sentence. */
function unglueSentenceEmoji(sentence: string, atStart: boolean) {
  const pattern = new RegExp(EMOJI_CLUSTER, "gu");
  const glued: Array<{ index: number; emoji: string }> = [];
  for (const match of sentence.matchAll(pattern)) {
    const emoji = match[0];
    const index = match.index ?? 0;
    const before = sentence[index - 1] ?? "";
    const after = sentence[index + emoji.length] ?? "";
    const betweenHan = /\p{Script=Han}/u.test(before) && /\p{Script=Han}/u.test(after);
    const onDish = DISH_GLUE.test(sentence.slice(Math.max(0, index - 16), index + emoji.length));
    if (betweenHan || onDish) glued.push({ index, emoji });
  }
  if (glued.length === 0) return sentence;
  let text = sentence;
  const moved: string[] = [];
  for (let index = glued.length - 1; index >= 0; index -= 1) {
    const item = glued[index];
    if (!item) continue;
    text = text.slice(0, item.index) + text.slice(item.index + item.emoji.length);
    moved.push(item.emoji);
  }
  const unique = [...new Set(moved.reverse())];
  const ending = text.match(/[。！？!?]+$/u)?.[0] ?? "";
  const body = text.replace(/[。！？!?]+$/u, "").replace(/[ \t]{2,}/g, " ").trim();
  return atStart ? `${unique.join("")}${body}${ending}` : `${body}${ending}${unique.join("")}`;
}

function loosenCaptionEmojiPlacement(story: string, seed: number) {
  let seen = 0;
  return story
    .split(/\n\n/)
    .map((paragraph) =>
      paragraph
        .split(/(?<=[。！？!?])|\n/u)
        .map((sentence) => {
          seen += 1;
          return unglueSentenceEmoji(sentence, (seed + seen) % 2 === 0);
        })
        .filter((sentence) => sentence.trim())
        .join(""),
    )
    .filter((paragraph) => paragraph.trim())
    .join("\n\n");
}

function sentenceParts(block: string) {
  return block
    .split(/(?<=[。！？!?])|(?<=\p{Extended_Pictographic}\uFE0F?)\s+(?=\p{Script=Han})/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function emojiForSentence(sentence: string) {
  const plain = sentence.replace(/\p{Extended_Pictographic}/gu, "");
  if (/鲈鱼|青柠蒸鲈鱼/.test(plain)) return "🐟";
  if (/蟹/.test(plain)) return "🦀";
  if (/虾/.test(plain)) return "🍤";
  if (/芒果/.test(plain)) return "🥭";
  if (/柠檬|青柠/.test(plain)) return "🍋";
  if (/咖喱/.test(plain)) return "🍛";
  if (/冬阴功/.test(plain)) return "🍤";
  if (/炒饭|糯米饭|滑蛋饭/.test(plain)) return "🍚";
  if (/舒服|放松/.test(plain)) return "😌";
  if (/好喝|好吃/.test(plain)) return "😋";
  if (/逛街|逛完|购物/.test(plain)) return "🛍️";
  return "";
}

function decorativeEmojiCount(text: string) {
  return text.replace(/🇹🇭/g, "").match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
}

/** One related emoji when the whole caption has none. Does not add a second pass, and does not invent a match. */
function addOneRelatedEmoji(story: string, style: HumanStyleSelection | undefined, seed: number) {
  if (decorativeEmojiCount(story) > 0) return story;
  const paragraphs = story.split(/\n\n/);
  const candidates: Array<{ paragraph: number; sentence: number; emoji: string; text: string }> = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    sentenceParts(paragraph).forEach((sentence, sentenceIndex) => {
      const emoji = emojiForSentence(sentence);
      if (emoji) candidates.push({ paragraph: paragraphIndex, sentence: sentenceIndex, emoji, text: sentence });
    });
  });
  if (candidates.length === 0) return story;
  const persona = style?.primaryStyle;
  const preferred =
    persona === "emotional" || persona === "chatty"
      ? candidates.find((item) => /喜欢|高兴|开心|然后|其实|真的|太/.test(item.text))
      : persona === "travel"
        ? candidates.find((item) => /逛|商场|过来|约上/.test(item.text))
        : persona === "story"
          ? candidates.find((item) => /之后|然后|总算|终于/.test(item.text))
          : persona === "foodie"
            ? candidates.find((item) => /新鲜|开胃|粘度|甜|口感|配料|香/.test(item.text))
            : persona === "short" || persona === "local" || persona === "casual"
              ? candidates[candidates.length - 1]
              : candidates[Math.abs(seed) % candidates.length];
  const candidate = preferred ?? candidates[Math.abs(seed) % candidates.length];
  if (!candidate) return story;
  const atStart =
    persona === "local" || persona === "short"
      ? seed % 4 === 0
      : persona === "casual"
        ? seed % 2 === 1
        : seed % 2 === 0;
  return paragraphs
    .map((paragraph, paragraphIndex) => {
      if (paragraphIndex !== candidate.paragraph) return paragraph;
      return sentenceParts(paragraph)
        .map((sentence, sentenceIndex) => {
          if (sentenceIndex !== candidate.sentence) return sentence;
          const body = sentence.replace(/[。！？!?]+$/u, "");
          const ending = sentence.match(/[。！？!?]+$/u)?.[0] ?? "";
          return atStart ? `${candidate.emoji}${body}${ending}` : `${body}${ending}${candidate.emoji}`;
        })
        .reduce((text, sentence) => {
          if (!text) return sentence;
          if (/\p{Extended_Pictographic}$/u.test(text)) return `${text} ${sentence}`;
          return `${text}${sentence}`;
        }, "");
    })
    .join("\n\n");
}

export function ensureCaptionEmojis(caption: string, style?: HumanStyleSelection, note = "") {
  const keepClusters =
    style?.primaryStyle === "playful" ||
    style?.primaryStyle === "emotional" ||
    style?.secondaryStyle === "playful";
  const { story, location } = splitCaptionStoryAndLocation(fixFruitEmojis(caption));
  const seeded = Math.round((style?.variation ?? 0) * 100) + Math.round((style?.intensity ?? 0) * 10);
  const withOne = customerBannedEmoji(note) ? story : addOneRelatedEmoji(story, style, seeded);
  const next = attachOrphanEmoji(tidyEmojiPunctuation(loosenCaptionEmojiPlacement(withOne, seeded), keepClusters));
  if (!location) return next;
  return `${next}\n\n${location}`;
}
