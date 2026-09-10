export const REQUIRED_HASHTAGS = ["#baanying曼谷", "#曼谷必吃", "#centralworld泰餐推荐"] as const;
export const RANDOM_HASHTAG_POOL = [
  "#centralworld",
  "#曼谷centralworld",
  "#centralworld美食",
  "#泰国",
  "#泰国旅游",
  "#泰国旅游攻略",
  "#泰国美食",
  "#曼谷泰餐推荐",
  "#centralworld泰餐",
  "#曼谷",
  "#曼谷美食",
  "#泰国菜",
  "#曼谷打卡",
  "#曼谷探店推荐",
  "#曼谷正宗泰餐",
  "#曼谷泰式家常菜",
] as const;
export const HASHTAG_COUNT = 5;
export const DYNAMIC_HASHTAG_COUNT = 2;
export const FIXED_HASHTAG_LINE = REQUIRED_HASHTAGS.join(" ");

export type GeneratedHashtags = [string, string, string, string, string];

const POOL_KEYS = new Set(RANDOM_HASHTAG_POOL.map((tag) => tag.toLowerCase()));

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

Exactly 5 hashtags, in this order:
1. #baanying曼谷
2. #曼谷必吃
3. #centralworld泰餐推荐
4–5. exactly 2 tags randomly chosen from the approved pool. Never invent, shorten, combine, translate, or rewrite pool tags.

Approved pool ONLY:
#centralworld #曼谷centralworld #centralworld美食 #泰国 #泰国旅游 #泰国旅游攻略 #泰国美食 #曼谷泰餐推荐 #centralworld泰餐 #曼谷 #曼谷美食 #泰国菜 #曼谷打卡 #曼谷探店推荐 #曼谷正宗泰餐 #曼谷泰式家常菜

The 2 random tags MUST be different from each other and should differ from previousHashtags when another pair exists.
Never pick the 3 fixed tags as the random pair. Never output a tag outside this pool.`;

export const STRICT_HASHTAG_RULES = `【HASHTAG GENERATION — SEPARATE MODULE】

You generate hashtags ONLY. You do NOT write captions.

Return ONLY the 5 hashtags. No explanations.

1. FIXED HASHTAGS (always first, exact spelling, this order):
${FIXED_HASHTAG_LINE}

2. RANDOM HASHTAGS:
Select exactly 2 different hashtags from this pool only:
#centralworld #曼谷centralworld #centralworld美食 #泰国 #泰国旅游 #泰国旅游攻略 #泰国美食 #曼谷泰餐推荐 #centralworld泰餐 #曼谷 #曼谷美食 #泰国菜 #曼谷打卡 #曼谷探店推荐 #曼谷正宗泰餐 #曼谷泰式家常菜
Do not invent, shorten, combine, translate, or rewrite them.
Do not pick any of the 3 fixed hashtags as the random pair.
Do not repeat the previous random pair when another pair exists.

3. COUNT: exactly 5. Order: 3 fixed, then 2 random.

4. OUTPUT:
${FIXED_HASHTAG_LINE} #随机1 #随机2`;

function formatHashtag(value: string) {
  const trimmed = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return trimmed ? `#${trimmed}` : "";
}

function tagKey(value: string) {
  return formatHashtag(value).toLowerCase();
}

export function isRequiredHashtag(tag: string) {
  return (REQUIRED_HASHTAGS as readonly string[]).some((required) => tagKey(required) === tagKey(tag));
}

export function isPoolHashtag(tag: string) {
  return POOL_KEYS.has(tagKey(tag));
}

function previousRandomTags(previous?: string[] | null) {
  return (previous ?? []).map(formatHashtag).filter((tag) => tag && isPoolHashtag(tag) && !isRequiredHashtag(tag));
}

function pickRandomPoolHashtags(exclude: string[] = []): [string, string] {
  const blocked = new Set(exclude.map(tagKey));
  const available = RANDOM_HASHTAG_POOL.filter((tag) => !blocked.has(tagKey(tag)));
  const source = available.length >= DYNAMIC_HASHTAG_COUNT ? available : [...RANDOM_HASHTAG_POOL];
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return [shuffled[0], shuffled[1]];
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
 * Always 3 fixed tags, then exactly 2 approved-pool tags.
 * Candidates outside the pool are dropped. Gaps are filled at random.
 */
export function normalizeHashtags(
  candidates: string[] = [],
  previousHashtags: string[] = [],
): GeneratedHashtags {
  const required = [...REQUIRED_HASHTAGS];
  const seen = new Set(required.map(tagKey));
  const previousRandom = previousRandomTags(previousHashtags);
  const extras: string[] = [];

  for (const candidate of candidates) {
    const tag = formatHashtag(candidate);
    if (!tag || seen.has(tagKey(tag)) || !isPoolHashtag(tag)) continue;
    seen.add(tagKey(tag));
    extras.push(tag);
    if (extras.length === DYNAMIC_HASHTAG_COUNT) break;
  }

  const sameAsPrevious =
    extras.length === DYNAMIC_HASHTAG_COUNT &&
    previousRandom.length === DYNAMIC_HASHTAG_COUNT &&
    extras.every((tag) => previousRandom.some((item) => tagKey(item) === tagKey(tag)));
  if (sameAsPrevious) {
    for (const tag of extras) seen.delete(tagKey(tag));
    extras.length = 0;
  }

  if (extras.length < DYNAMIC_HASHTAG_COUNT) {
    const [first, second] = pickRandomPoolHashtags([...required, ...extras, ...previousRandom]);
    for (const tag of [first, second]) {
      if (extras.length === DYNAMIC_HASHTAG_COUNT) break;
      if (seen.has(tagKey(tag))) continue;
      seen.add(tagKey(tag));
      extras.push(tag);
    }
  }

  if (extras.length < DYNAMIC_HASHTAG_COUNT) {
    const [first, second] = pickRandomPoolHashtags([...required, ...extras]);
    extras.push(first, second);
  }

  return [required[0], required[1], required[2], extras[0], extras[1]];
}

export function validateHashtags(
  aiHashtags?: string[] | null,
  caption?: string,
  previousHashtags: string[] = [],
): GeneratedHashtags {
  const fromCaption = caption ? extractHashtags(caption) : [];
  return normalizeHashtags([...(aiHashtags ?? []), ...fromCaption], previousHashtags);
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
  if (extras.some((tag) => !isPoolHashtag(tag))) return null;
  return normalizeHashtags(tags);
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
  previousHashtags: string[] = [],
): { caption: string; hashtags: GeneratedHashtags } {
  const fromCaption = extractHashtags(caption);
  return {
    caption: stripAllHashtagsFromCaption(caption),
    hashtags: normalizeHashtags([...(aiHashtags ?? []), ...fromCaption], previousHashtags),
  };
}

/** Keep required tags first; keep at most 2 approved-pool extras. */
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
