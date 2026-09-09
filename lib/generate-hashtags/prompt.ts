import { STRICT_HASHTAG_RULES } from "@/lib/hashtags";
import { CONTENT_LANGUAGE } from "@/lib/i18n";

export type HashtagGenerateInput = {
  caption: string;
  dishes?: string[];
  recommendReasons?: string[];
  previousHashtags?: string[];
  contentAngle?: string;
};

function list(values: string[] | undefined) {
  const items = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items.join("、") : "Not provided";
}

export function buildHashtagSystemPrompt() {
  return `You are a Xiaohongshu hashtag generator.

You do NOT write captions, titles, or Location & Time.
The caption has already been generated. Your only job is to output hashtags for that caption.

LANGUAGE:
- Hashtags may mix Simplified Chinese (${CONTENT_LANGUAGE}) and the two fixed brand tags.
- Do not translate or rewrite the two fixed hashtags.

${STRICT_HASHTAG_RULES}`;
}

export function buildHashtagUserPrompt(input: HashtagGenerateInput) {
  const previousDynamic = (input.previousHashtags ?? []).filter(
    (tag) => tag !== "#baanying曼谷" && tag !== "#曼谷必吃",
  );

  return `Generate hashtags for this completed Xiaohongshu caption.

COMPLETED CAPTION:
${input.caption.trim() || "Not provided"}

SELECTED DISHES (context only; only use dishes that actually appear in the caption or were provided):
${list(input.dishes)}

FOOD CHARACTERISTICS / RECOMMEND REASONS:
${list(input.recommendReasons)}

CONTENT ANGLE (for dynamic hashtag relevance only; do not invent claims):
${input.contentAngle?.trim() || "Not provided"}

PREVIOUS DYNAMIC HASHTAGS:
${previousDynamic.length > 0 ? previousDynamic.join(" ") : "None"}
The 3 dynamic hashtags MUST differ from the previous dynamic hashtags when another relevant set exists.

${STRICT_HASHTAG_RULES}

Return ONLY the 5 hashtags, in this order:
#baanying曼谷 #曼谷必吃 #动态标签1 #动态标签2 #动态标签3`;
}
