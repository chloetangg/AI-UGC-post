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
  else if (/鱼|蒸鱼/i.test(story)) emojis.push("🐟");
  else emojis.push("🍛");
  emojis.push("😋");
  return emojis.slice(0, 2);
}

/**
 * Last-resort repair: insert 1–2 relevant emojis into the story body.
 * Never writes hashtags. Never touches Location & Time.
 */
export function ensureCaptionEmojis(caption: string) {
  if (captionHasRequiredEmojis(caption)) return caption;

  const { story, location } = splitCaptionStoryAndLocation(caption);
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
