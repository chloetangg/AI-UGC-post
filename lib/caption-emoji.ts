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

/**
 * Fix fruit emoji mix-ups only. Do not inject emojis to hit a quota.
 */
export function ensureCaptionEmojis(caption: string) {
  return fixFruitEmojis(caption);
}
