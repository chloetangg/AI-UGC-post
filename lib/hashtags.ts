export const REQUIRED_HASHTAGS = ["#baanying曼谷", "#曼谷必吃"] as const;
export const FALLBACK_HASHTAGS = ["#泰菜推荐", "#曼谷美食", "#曼谷探店"] as const;
export const HASHTAG_COUNT = 5;
export const DYNAMIC_HASHTAG_COUNT = 3;
export const FIXED_HASHTAG_LINE = `${REQUIRED_HASHTAGS[0]} ${REQUIRED_HASHTAGS[1]}`;

export type GeneratedHashtags = [string, string, string, string, string];

export const CAPTION_NO_HASHTAG_RULES = `【CAPTION MUST NOT CONTAIN HASHTAGS】

Hashtag generation is a SEPARATE module. Do NOT generate hashtags while writing the caption.

The caption MUST contain ZERO hashtags.
Do NOT insert hashtags:
- In the opening
- In the middle of the caption
- At the end of the main caption
- Inside the Location & Time section

The caption should contain ONLY the actual story body.

Location & Time is appended by the system after the story, using one of 6 locked templates.
Do not write Location & Time yourself.

Correct caption structure after the system appends Location & Time:
[Main Caption]

[Location & Time Section]

Do NOT add a hashtag block after Location & Time.
Do NOT ask this caption generator to generate hashtags.
If a previous caption included hashtags, ignore them and do not copy them.`;

export const HASHTAGS_JSON_FIELD_RULES = `HASHTAGS — JSON field "hashtags" only. Never put hashtags in titles or caption.

Exactly 5 hashtags:
1. #baanying曼谷
2. #曼谷必吃
3–5. three dynamic tags based on THIS caption, selected dishes that actually appear, food qualities, Thai/Bangkok dining.

Fixed tags must be exact. Never #BaanYing曼谷, #BaanYing, #baanying, #曼谷必吃餐厅.
Dynamic tags should vary vs previousHashtags when another relevant set exists.
Derive the 3 dynamic tags from the FINAL caption plus actual customer evidence (dish, Thai cuisine, Bangkok dining, location, travel, shopping, dining context). Do NOT hard-code hashtags by Storyline or KSP.
Forbidden dynamic tags: #米其林餐厅 #曼谷第一 #曼谷唯一 #曼谷顶级 #曼谷最强 #明星同款 #必吃第一名 #最好吃 #全网第一 #销量冠军 #顶级 #封神 #必吃.
If unsure, use #泰菜推荐 #曼谷美食 #曼谷探店. The two fixed tags stay exact, including #曼谷必吃.`;

export const STRICT_HASHTAG_RULES = `【HASHTAG GENERATION — SEPARATE MODULE】

You generate hashtags ONLY. You do NOT write captions.

The caption has already been written. Use that completed caption as context.

Return ONLY the 5 hashtags. No explanations, sentences, bullet points, labels, or caption content.

1. FIXED HASHTAGS (MUST always be included, exactly as written, in this order):
${FIXED_HASHTAG_LINE}
NEVER change spelling, capitalization, Chinese characters, or wording.
NEVER translate, remove, replace, or shorten them.
NEVER use variations such as #BaanYing曼谷, #BaanYing, #baanYing曼谷, #baanying, #曼谷必吃餐厅.

2. DYNAMIC HASHTAGS:
Generate exactly 3 additional hashtags based on the completed caption.
Base them on: selected dishes in this caption, main food characteristics, content angle, Thai food, Bangkok food, restaurant / dining context.
They SHOULD vary between generations. Do NOT always reuse the same 3 dynamic hashtags.
If the featured dish or content angle changes, change at least 1–2 dynamic hashtags.
Examples:
- Yellow Curry Crab Meat focus: #黄咖喱蟹肉 #泰国菜 #曼谷美食
- Mango Sticky Rice focus: #芒果糯米饭 #泰国甜品 #曼谷美食
Avoid generic tags with no connection to the caption.

3. COUNT:
Exactly 5 hashtags in total: 2 fixed + 3 dynamic. Not 4, not 6, not more.

4. OUTPUT FORMAT:
Return ONLY this line:
${FIXED_HASHTAG_LINE} #动态标签1 #动态标签2 #动态标签3

Do NOT return explanations, "Here are your hashtags:", bullet points, extra text, or any caption content.

5. DO NOT INVENT FACTS:
Dynamic hashtags must be based on the completed caption, the customer's answers, or verified restaurant data.
Do NOT use unsupported or exaggerated tags such as #米其林餐厅 #曼谷第一 #明星同款 #必吃第一名 #最好吃 #全网第一 #销量冠军 #顶级 #封神 #必吃.

6. FINAL VALIDATION:
- Exactly 5 hashtags
- First two are exactly ${FIXED_HASHTAG_LINE}
- Exactly 3 relevant dynamic hashtags
- Fixed hashtags unmodified
- No additional text
If any check fails, correct before returning.`;

function formatHashtag(value: string) {
  const trimmed = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return trimmed ? `#${trimmed}` : "";
}

function tagKey(value: string) {
  return formatHashtag(value).toLowerCase();
}

function isForbiddenHashtag(tag: string) {
  if (isRequiredHashtag(tag)) return false;
  return /米其林|明星同款|必吃第一名|曼谷第一|曼谷唯一|曼谷最强|曼谷顶级|number\s*one|最好吃|全网第一|销量冠军|封神|顶级|最便宜|#第一|#必吃|#绝对/i.test(
    tag,
  );
}

export function isRequiredHashtag(tag: string) {
  return (REQUIRED_HASHTAGS as readonly string[]).includes(tag);
}

export function extractHashtags(text: string): string[] {
  return text.match(/#[^\s#]+/g) ?? [];
}

export function extractTrailingHashtags(caption: string): string[] {
  const tags: string[] = [];
  const lines = caption.replace(/\s+$/, "").split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(#[^\s#]+(?:\s+#[^\s#]+)*)$/.test(line)) {
      tags.unshift(...(line.match(/#[^\s#]+/g) ?? []));
      continue;
    }
    break;
  }
  return tags;
}

export function captionContainsHashtags(caption: string) {
  return extractHashtags(caption).length > 0;
}

/**
 * AI output pipeline: first two are always the fixed tags, then exactly 3 extras.
 */
export function normalizeHashtags(candidates: string[] = []): GeneratedHashtags {
  const required = [REQUIRED_HASHTAGS[0], REQUIRED_HASHTAGS[1]];
  const seen = new Set(required.map(tagKey));
  const extras: string[] = [];

  for (const candidate of candidates) {
    const tag = formatHashtag(candidate);
    if (!tag || seen.has(tagKey(tag))) continue;
    if (tagKey(tag) === "#baanying") continue;
    if (isForbiddenHashtag(tag)) continue;
    seen.add(tagKey(tag));
    extras.push(tag);
    if (extras.length === DYNAMIC_HASHTAG_COUNT) break;
  }

  for (const fallback of FALLBACK_HASHTAGS) {
    if (extras.length === DYNAMIC_HASHTAG_COUNT) break;
    if (seen.has(tagKey(fallback))) continue;
    seen.add(tagKey(fallback));
    extras.push(fallback);
  }

  return [
    required[0],
    required[1],
    extras[0] ?? FALLBACK_HASHTAGS[0],
    extras[1] ?? FALLBACK_HASHTAGS[1],
    extras[2] ?? FALLBACK_HASHTAGS[2],
  ];
}

export function validateHashtags(aiHashtags?: string[] | null, caption?: string): GeneratedHashtags {
  const fromCaption = caption ? extractHashtags(caption) : [];
  return normalizeHashtags([...(aiHashtags ?? []), ...fromCaption]);
}

export function isHashtagOnlyOutput(raw: string) {
  const leftover = raw.replace(/#[^\s#]+/g, "").replace(/[\s,，、]+/g, "").trim();
  return leftover.length === 0 && extractHashtags(raw).length > 0;
}

export function parseHashtagOnlyOutput(raw: string): GeneratedHashtags | null {
  if (!isHashtagOnlyOutput(raw)) return null;
  const tags = extractHashtags(raw).map(formatHashtag).filter(Boolean);
  if (tags.length !== HASHTAG_COUNT) return null;
  const missingFixed = REQUIRED_HASHTAGS.some(
    (required) => !tags.some((tag) => tagKey(tag) === tagKey(required)),
  );
  if (missingFixed) return null;
  const extras = tags.filter((tag) => !isRequiredHashtag(tag));
  if (extras.length !== DYNAMIC_HASHTAG_COUNT) return null;
  if (extras.some(isForbiddenHashtag)) return null;
  return [REQUIRED_HASHTAGS[0], REQUIRED_HASHTAGS[1], extras[0], extras[1], extras[2]];
}

export function applyHashtagsToCaption(caption: string, tags: string[]) {
  const body = stripAllHashtagsFromCaption(caption);
  const line = tags.filter(Boolean).join(" ");
  if (!line) return body;
  return body ? `${body}\n\n${line}` : line;
}

export function finalizeGeneratedHashtags(
  caption: string,
  aiHashtags?: string[] | null,
): { caption: string; hashtags: GeneratedHashtags } {
  const fromCaption = extractHashtags(caption);
  return {
    caption: stripAllHashtagsFromCaption(caption),
    hashtags: normalizeHashtags([...(aiHashtags ?? []), ...fromCaption]),
  };
}

/** Keep required tags first; keep at most 3 extras. */
export function ensureRequiredHashtags(tags: string[]): GeneratedHashtags {
  return normalizeHashtags(tags);
}

export function stripTrailingHashtagBlock(caption: string) {
  const lines = caption.replace(/\s+$/, "").split("\n");
  while (lines.length > 0) {
    const line = lines[lines.length - 1].trim();
    if (!line) {
      lines.pop();
      continue;
    }
    if (/^(#[^\s#]+(?:\s+#[^\s#]+)*)$/.test(line)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").replace(/\s+$/, "");
}

export function stripAllHashtagsFromCaption(caption: string) {
  return stripTrailingHashtagBlock(caption)
    .replace(/(^|\s)#[^\s#]+/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ensureFixedHashtagsInCaption(caption: string) {
  return stripAllHashtagsFromCaption(caption);
}
