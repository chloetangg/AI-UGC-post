import { stripGeneratedLocationTime } from "@/lib/locations";

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function splitCaptionStoryAndLocation(caption: string) {
  const trimmed = caption.trim();
  const story = stripGeneratedLocationTime(trimmed);
  const location = story && trimmed.startsWith(story) ? trimmed.slice(story.length).trim() : "";
  return { story: story || trimmed, location };
}

export function countEmojis(text: string) {
  return text.match(EMOJI_RE)?.length ?? 0;
}

/** Location & Time 📍/⏰ do not satisfy the Xiaohongshu emoji rule. */
export function countStoryEmojis(caption: string) {
  const { story } = splitCaptionStoryAndLocation(caption);
  return countEmojis(story);
}

export function captionHasRequiredEmojis(caption: string) {
  return countStoryEmojis(caption) >= 1;
}

function pickFallbackEmojis(story: string) {
  const emojis: string[] = [];
  if (/蟹|curry crab|咖喱蟹/i.test(story)) emojis.push("🦀");
  else if (/虾|goong|冬阴功|蒜蓉炒虾/i.test(story)) emojis.push("🍤");
  else if (/芒果|mango/i.test(story)) emojis.push("🥭");
  else if (/柠檬|檸檬|lemon/i.test(story)) emojis.push("🍋");
  else if (/鱼|蒸鱼/i.test(story)) emojis.push("🐟");
  else emojis.push("🍛");
  emojis.push("😋");
  return emojis.slice(0, 2);
}

function chunkHasMango(text: string) {
  return /芒果|mango/i.test(text);
}

function chunkHasLemon(text: string) {
  return /柠檬|檸檬|lemon/i.test(text);
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

/**
 * Last-resort repair: insert 1–2 relevant emojis into the story body.
 * Never writes hashtags. Never touches Location & Time.
 */
export function ensureCaptionEmojis(caption: string) {
  const captionWithFruit = fixFruitEmojis(caption);
  if (captionHasRequiredEmojis(captionWithFruit)) return captionWithFruit;

  const { story, location } = splitCaptionStoryAndLocation(captionWithFruit);
  if (!story) return caption;

  const extras = pickFallbackEmojis(story);
  const sentenceMatch = story.match(/^(.+?[。！？\n])/);
  let nextStory: string;
  if (sentenceMatch?.[1]) {
    const first = sentenceMatch[1].replace(/\s+$/, "");
    nextStory = `${first}${extras[0]} ${story.slice(first.length).trimStart()}`;
  } else {
    nextStory = `${story}${extras[0]}`;
  }

  if (countEmojis(nextStory) < 2 && extras[1] && !nextStory.includes(extras[1])) {
    nextStory = `${nextStory.trimEnd()}${extras[1]}`;
  }

  return location ? `${nextStory}\n\n${location}` : nextStory;
}
