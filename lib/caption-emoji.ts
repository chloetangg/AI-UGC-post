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
  return /不要\s*(?:加)?\s*(?:表情|emoji)|无表情/i.test(note);
}

/** `titleLine: false` drops the title summary for prompts that already send TITLE FORMAT. */
export function formatCaptionEmojiRules(options: { titleLine?: boolean } = {}) {
  const titleLine =
    options.titleLine === false
      ? ""
      : "\nTitles, separately: at least one of the 3 titles has an emoji. Usually one or two titles have one each. Start or end, not glued to the dish name, and not a copy of the caption placement. Do not leave all 3 titles bare just because the caption is sparse. A customer ban overrides this title minimum. Do not repeat one placement on every title.";
  return `EMOJI — follow THIS ROUND HUMAN STYLE. Do not pick a count first and then fill it in. Titles use the same approved list, but title placement is a separate rule.

Approved list only: ${STORY_EMOJI_POOL.join(" ")}
Match the meaning of THIS sentence: 蟹→🦀, 虾/河虾冬阴功汤→🍤, 芒果→🥭, 柠檬→🍋, 青柠蒸鲈鱼/鲈鱼→🐟, 炒饭/糯米饭→🍚, 冬阴功→🍤, 咖喱→🍛. 逛街/购物→🛍️. Feeling, only in a sentence that is not already a food line: 好吃/好喝→😋, 香/还想吃→🤤, 帅→😍, 舒服/放松→😌.
🍋 is 柠檬 only. 🥭 is 芒果 only. 🐟 is fish only. Never put 🥭 or 🍋 on 鲈鱼, and never put 🐟 on a later sentence about 安心 just because fish was mentioned earlier.
Body: Foodie stays with texture or taste, not one emoji per dish. Chatty sits in an aside or an exclamation, unevenly. Casual uses one or two, with a feeling or at a sentence end. Story marks a turn or two, not every beat. Short uses one at the real point, and a second only when it runs to three or more sentences. Playful can place a few, and occasionally a pair, with the loose tone. Travel stays with a real place or scene. Local is sparse: one or two natural spots, not a guide sticker. Emotional follows how strong the customer's own feeling already is.
These are habits, not a fixed position for that persona. Do not put one on every sentence or every dish. Do not glue one to every dish name. Do not add an unrelated emoji to look human. Local and Short may use few, but do not leave the whole caption without one, or stuck at a single one in a 3–6 sentence caption, just because the style is quiet, unless the customer said 不要表情 / 不要 emoji / 无表情.
Usual spread, not a quota: a 1–2 sentence caption has about one; a normal 3–6 sentence caption ends up with about 2–4 on different sentences. Each one belongs to its own sentence's food, feeling, or scene.
Place them differently: sentence start, sentence end, after the reaction, or inside the sentence when that reads naturally.${titleLine}
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
  let next = text.replace(new RegExp(`(${EMOJI_CLUSTER})[ \\t]*[。．.，,！!？?；;]+`, "gu"), "$1 ");
  if (!keepClusters) {
    next = next.replace(new RegExp(`(${EMOJI_CLUSTER})(?:[ \\t]*${EMOJI_CLUSTER})+`, "gu"), "$1");
  }
  return next.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/gm, "");
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

const WORD = /[\p{Script=Han}A-Za-z0-9]/u;
const CLAUSE_BREAK = /[。！？!?，,、；;：:\s]/u;

/** Start of the sentence that holds `index`: after the last 。！？, line break, or an emoji that already ends a clause. */
function sentenceStartBefore(line: string, index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = line[cursor] ?? "";
    if (/[。！？!?]/u.test(char)) return cursor + 1;
    if (/[ \t]/.test(char) && new RegExp(`${EMOJI_CLUSTER}$`, "u").test(line.slice(0, cursor))) return cursor + 1;
  }
  return 0;
}

/**
 * One misplaced emoji per call, or null when every emoji already sits well.
 * An emoji that ends a real clause keeps its spot and gets the space that marks the break,
 * so two sentences never merge. One glued to a dish name or splitting a short phrase moves to the start of its sentence.
 */
function settleOneEmoji(line: string) {
  for (const match of line.matchAll(new RegExp(EMOJI_CLUSTER, "gu"))) {
    const emoji = match[0];
    const index = match.index ?? 0;
    const before = line[index - 1] ?? "";
    const after = line[index + emoji.length] ?? "";
    const onDish = DISH_GLUE.test(line.slice(Math.max(0, index - 16), index + emoji.length));
    const betweenWords = WORD.test(before) && WORD.test(after);
    if (!onDish && !betweenWords) continue;
    const start = sentenceStartBefore(line, index);
    let run = 0;
    for (let cursor = index - 1; cursor >= start && !CLAUSE_BREAK.test(line[cursor] ?? ""); cursor -= 1) run += 1;
    if (!onDish && run >= 3) return `${line.slice(0, index + emoji.length)} ${line.slice(index + emoji.length)}`;
    const without = line.slice(0, index) + line.slice(index + emoji.length);
    if (start === index) return null;
    const lead = without.slice(start).match(/^[ \t]*/)?.[0].length ?? 0;
    if (new RegExp(`^${EMOJI_CLUSTER}`, "u").test(without.slice(start + lead))) return without;
    return `${without.slice(0, start + lead)}${emoji}${without.slice(start + lead)}`;
  }
  return null;
}

function settleCaptionEmojiPlacement(story: string) {
  return story
    .split("\n")
    .map((line) => {
      let next = line;
      for (let pass = 0; pass < 12; pass += 1) {
        const settled = settleOneEmoji(next);
        if (settled === null || settled === next) break;
        next = settled;
      }
      return next;
    })
    .join("\n");
}

const FOOD_EMOJI_WORDS: Array<{ emoji: string; words: RegExp }> = [
  { emoji: "🐟", words: /鱼/ },
  { emoji: "🦀", words: /蟹/ },
  { emoji: "🍤", words: /虾|冬阴功/ },
  { emoji: "🥭", words: /芒果/ },
  { emoji: "🍋", words: /柠檬|檸檬|青柠/ },
  { emoji: "🍛", words: /咖喱/ },
  { emoji: "🧋", words: /奶茶|泰奶|粉红奶|奶绿/ },
  { emoji: "🍚", words: /饭/ },
  { emoji: "🍜", words: /面条|拉面|炒面|汤面|河粉|米粉|粉丝/ },
  { emoji: "🌶️", words: /辣/ },
];

function foodEmojiFor(text: string) {
  if (/鲈鱼/.test(text)) return "🐟";
  return FOOD_EMOJI_WORDS.find((row) => row.words.test(text))?.emoji ?? "";
}

/** A food emoji names a food in its own sentence. Wrong food → that sentence's food. No food at all → dropped. */
function fixCaptionFoodEmojis(story: string) {
  return story
    .split(/(?<=[。！？!?\n])/u)
    .map((sentence) => {
      const plain = sentence.replace(/\p{Extended_Pictographic}\uFE0F?/gu, "");
      let next = sentence;
      for (const row of FOOD_EMOJI_WORDS) {
        const base = row.emoji.replace(/\uFE0F/g, "");
        if (!next.includes(base)) continue;
        const fits = row.words.test(plain) && !(/鲈鱼/.test(plain) && (row.emoji === "🍋" || row.emoji === "🥭"));
        if (fits) continue;
        const replacement = foodEmojiFor(plain);
        const swap = replacement && !next.includes(replacement.replace(/\uFE0F/g, "")) ? replacement : "";
        next = next.replace(new RegExp(`${base}\\uFE0F?`, "u"), swap);
      }
      return next;
    })
    .join("");
}

/** The customer asked for no emoji: remove them. An emoji that ended a sentence leaves a full stop, not a merge. */
function stripCaptionEmojis(story: string) {
  return story
    .replace(new RegExp(`(${EMOJI_CLUSTER})[ \\t]+(?=[\\p{Script=Han}A-Za-z])`, "gu"), "。")
    .replace(new RegExp(`(?<=[\\p{Script=Han}A-Za-z0-9])${EMOJI_CLUSTER}(?=[\\p{Script=Han}A-Za-z])`, "gu"), "，")
    .replace(new RegExp(EMOJI_CLUSTER, "gu"), "")
    .replace(/([。！？!?，,])[。，]/g, "$1")
    .replace(/。{2,}/g, "。")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+|[ \t]+$/gm, "");
}

/** The sentence's own food first, then its own feeling or scene. Empty when nothing in the sentence supports one. */
function emojiForSentence(sentence: string) {
  const plain = sentence.replace(/\p{Extended_Pictographic}\uFE0F?/gu, "");
  const food = foodEmojiFor(plain.replace(/辣|吃饭|饭店|饭后|饭点|[午晚早]饭/g, ""));
  if (food) return food;
  if (/舒服|放松/.test(plain)) return "😌";
  if (/好喝|好吃|好好吃/.test(plain)) return "😋";
  if (/香|还想吃|还想再|再点|还会点|还想点/.test(plain)) return "🤤";
  if (/逛街|逛完|逛累|购物/.test(plain)) return "🛍️";
  if (/帅/.test(plain)) return "😍";
  if (/喜欢|开心|高兴|满意/.test(plain)) return "🥰";
  if (/没想到|居然|竟然/.test(plain)) return "👀";
  if (/不错/.test(plain) && /奶|茶|汤|饭|菜|肉|虾|蟹|鱼|味道/.test(plain)) return "😋";
  if (/拍照|好看|出片/.test(plain)) return "✨";
  return "";
}

function decorativeEmojiCount(text: string) {
  return text.replace(/🇹🇭/g, "").match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
}

type Piece = { text: string; sep: string };

/** Sentences with their exact separators, so joining them back gives the same paragraph. */
function pieces(paragraph: string): Piece[] {
  const parts = paragraph.split(new RegExp(`([。！？!?]+[ \\t]*|(?:${EMOJI_CLUSTER})+[ \\t]+)`, "u"));
  const result: Piece[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const text = parts[index] ?? "";
    const sep = parts[index + 1] ?? "";
    if (text || sep) result.push({ text, sep });
  }
  return result;
}

/**
 * The persona sets how sparse the body is, not a fixed count. A normal 3–6 sentence caption ends with 2–4.
 * Short captions (1–2 sentences) need one. Nothing is added when no sentence names something an emoji can match.
 */
function storyEmojiFloor(sentences: number, style: HumanStyleSelection | undefined, seed: number) {
  if (sentences <= 2) return 1;
  const persona = style?.primaryStyle;
  if ((persona === "local" || persona === "short") && sentences <= 3) return 1;
  const lively = persona === "playful" || persona === "chatty" || persona === "foodie" || persona === "emotional";
  const extra = lively && seed % 3 !== 0 && sentences >= 4 ? 1 : 0;
  return 2 + extra;
}

const PERSONA_PREFERS: Partial<Record<string, RegExp>> = {
  emotional: /喜欢|高兴|开心|满足|真的|太/,
  chatty: /其实|结果|然后|真的|太/,
  travel: /逛|商场|过来|约上/,
  story: /之后|然后|总算|这次/,
  foodie: /新鲜|开胃|粘度|甜|口感|配料|香|鲜|嫩/,
  playful: /哈哈|绝了|太|真的/,
};

/** Fill up to the floor with emoji tied to their own sentence. Spread out, never repeated, never on every sentence. */
function topUpRelatedEmojis(story: string, style: HumanStyleSelection | undefined, seed: number) {
  const paragraphs = story.split("\n\n").map(pieces);
  const flat = paragraphs.flatMap((list, paragraph) => list.map((piece, index) => ({ paragraph, index, piece })));
  const sentences = flat.filter((item) => item.piece.text.replace(/[\s\p{Extended_Pictographic}\uFE0F]/gu, "").length >= 2);
  const floor = storyEmojiFloor(sentences.length, style, seed);
  let count = decorativeEmojiCount(story);
  if (count >= floor) return story;
  const used = new Set((story.match(/\p{Extended_Pictographic}/gu) ?? []).map((item) => item));
  const hasEmoji = (item: (typeof flat)[number]) => /\p{Extended_Pictographic}/u.test(`${item.piece.text}${item.piece.sep}`);
  const prefers = PERSONA_PREFERS[style?.primaryStyle ?? ""];
  const ranked = sentences
    .map((item, order) => ({ item, order, emoji: emojiForSentence(item.piece.text) }))
    .filter((row) => row.emoji && !hasEmoji(row.item))
    .sort((a, b) => Number(Boolean(prefers?.test(b.item.piece.text))) - Number(Boolean(prefers?.test(a.item.piece.text))) || a.order - b.order);
  const marked = new Set(sentences.map((item, order) => (hasEmoji(item) ? order : -1)).filter((order) => order >= 0));
  for (const pass of [true, false]) {
    for (const row of ranked) {
      if (count >= floor) break;
      const base = row.emoji.replace(/\uFE0F/g, "");
      if (used.has(base) || marked.has(row.order)) continue;
      if (pass && (marked.has(row.order - 1) || marked.has(row.order + 1))) continue;
      const list = paragraphs[row.item.paragraph];
      const piece = list?.[row.item.index];
      if (!list || !piece) continue;
      const last = row.item.index === list.length - 1;
      const atStart = row.item.index === 0 && (seed + row.order) % 3 === 0;
      if (atStart) {
        piece.text = `${row.emoji}${piece.text}`;
      } else if (/^。[ \t]*$/.test(piece.sep) || piece.sep === "") {
        piece.sep = `${row.emoji}${last ? "" : " "}`;
      } else {
        piece.sep = `${piece.sep.trimEnd()}${row.emoji}${last ? "" : " "}`;
      }
      used.add(base);
      marked.add(row.order);
      count += 1;
    }
  }
  return paragraphs.map((list) => list.map((piece) => `${piece.text}${piece.sep}`).join("")).join("\n\n");
}

/**
 * Only emoji change here: placement, a wrong food emoji, the customer's ban, and a related emoji where the body is too bare.
 * Sentences, their order, paragraphs, and Location & Time stay as they are.
 */
export function ensureCaptionEmojis(caption: string, style?: HumanStyleSelection, note = "") {
  const keepClusters =
    style?.primaryStyle === "playful" ||
    style?.primaryStyle === "emotional" ||
    style?.secondaryStyle === "playful";
  const { story, location } = splitCaptionStoryAndLocation(caption);
  const seeded = Math.round((style?.variation ?? 0) * 100) + Math.round((style?.intensity ?? 0) * 10);
  const withLocation = (body: string) => (location ? `${body}\n\n${location}` : body);
  if (customerBannedEmoji(note)) return withLocation(stripCaptionEmojis(story));
  const placed = attachOrphanEmoji(
    tidyEmojiPunctuation(settleCaptionEmojiPlacement(fixCaptionFoodEmojis(story)), keepClusters),
  );
  return withLocation(topUpRelatedEmojis(placed, style, seeded));
}
