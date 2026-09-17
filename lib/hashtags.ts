export const REQUIRED_HASHTAGS = ["#baanying曼谷"] as const;
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
  "#曼谷必吃",
  "#centralworld泰餐推荐",
] as const;
export const HASHTAG_COUNT = 5;
export const DYNAMIC_HASHTAG_COUNT = 4;
export const FIXED_HASHTAG_LINE = REQUIRED_HASHTAGS.join(" ");
export const POOL_HASHTAG_LINE = RANDOM_HASHTAG_POOL.join(" ");

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

Exactly 5 hashtags:
- Always include #baanying曼谷
- Pick exactly 4 different tags from the approved pool. Never invent, shorten, combine, translate, or rewrite pool tags.
- Shuffle all 5 into a random order. #baanying曼谷 is NOT always first.

Approved pool ONLY:
${POOL_HASHTAG_LINE}

The 4 random tags MUST be different from each other and should differ from previousHashtags when another set exists.
Never pick #baanying曼谷 as one of the 4 random tags. Never output a tag outside this pool.`;

export const STRICT_HASHTAG_RULES = `【HASHTAG GENERATION — SEPARATE MODULE】

You generate hashtags ONLY. You do NOT write captions.

Return ONLY the 5 hashtags. No explanations.

1. FIXED HASHTAG (always include, exact spelling, random position):
#baanying曼谷

2. RANDOM HASHTAGS:
Select exactly 4 different hashtags from this pool only:
${POOL_HASHTAG_LINE}
Do not invent, shorten, combine, translate, or rewrite them.
Do not pick #baanying曼谷 as one of the 4 random tags.
Do not repeat the previous random set when another set exists.

3. COUNT: exactly 5. Shuffle the 1 fixed tag + 4 random tags into a random order.

4. OUTPUT: five hashtags separated by spaces, in random order.`;

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

function shuffleTags(tags: string[]): string[] {
  const next = [...tags];
  const cryptoObj = globalThis.crypto;
  for (let index = next.length - 1; index > 0; index -= 1) {
    let swap = Math.floor(Math.random() * (index + 1));
    if (typeof cryptoObj?.getRandomValues === "function") {
      const bytes = new Uint32Array(1);
      cryptoObj.getRandomValues(bytes);
      swap = bytes[0] % (index + 1);
    }
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function asFive(tags: string[]): GeneratedHashtags {
  return [tags[0] ?? "", tags[1] ?? "", tags[2] ?? "", tags[3] ?? "", tags[4] ?? ""];
}

function sameTagSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((tag) => right.some((item) => tagKey(item) === tagKey(tag)));
}

function pickRandomPoolHashtags(exclude: string[] = []): string[] {
  const blocked = new Set(exclude.map(tagKey));
  const available = RANDOM_HASHTAG_POOL.filter((tag) => !blocked.has(tagKey(tag)));
  const source = available.length >= DYNAMIC_HASHTAG_COUNT ? available : [...RANDOM_HASHTAG_POOL];
  return shuffleTags([...source]).slice(0, DYNAMIC_HASHTAG_COUNT);
}

function fillPoolHashtags(current: string[], exclude: string[]) {
  const extras = [...current];
  const seen = new Set(extras.map(tagKey));
  const [firstPass, secondPass] = [
    pickRandomPoolHashtags([...REQUIRED_HASHTAGS, ...extras, ...exclude]),
    pickRandomPoolHashtags([...REQUIRED_HASHTAGS, ...extras]),
  ];
  for (const tag of [...firstPass, ...secondPass]) {
    if (extras.length === DYNAMIC_HASHTAG_COUNT) break;
    if (seen.has(tagKey(tag))) continue;
    seen.add(tagKey(tag));
    extras.push(tag);
  }
  return extras.slice(0, DYNAMIC_HASHTAG_COUNT);
}

function orderHashtags(candidates: string[], extras: string[], required: string) {
  const allowed = new Map<string, string>();
  allowed.set(tagKey(required), required);
  for (const tag of extras) allowed.set(tagKey(tag), tag);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const tag = formatHashtag(candidate);
    const key = tagKey(tag);
    const canonical = allowed.get(key);
    if (!canonical || seen.has(key)) continue;
    seen.add(key);
    ordered.push(canonical);
  }
  if (!seen.has(tagKey(required))) {
    ordered.unshift(required);
    seen.add(tagKey(required));
  }
  for (const tag of extras) {
    if (ordered.length >= HASHTAG_COUNT) break;
    if (seen.has(tagKey(tag))) continue;
    seen.add(tagKey(tag));
    ordered.push(tag);
  }
  return ordered.slice(0, HASHTAG_COUNT);
}

/**
 * Always include #baanying曼谷 plus exactly 4 approved-pool tags.
 * Generation shuffles all 5. Manual edits keep the current order.
 */
export function normalizeHashtags(
  candidates: string[] = [],
  previousHashtags: string[] = [],
  options: { shuffle?: boolean } = {},
): GeneratedHashtags {
  const shuffle = options.shuffle !== false;
  const required = REQUIRED_HASHTAGS[0];
  const seen = new Set([tagKey(required)]);
  const previousRandom = previousRandomTags(previousHashtags);
  let extras: string[] = [];

  for (const candidate of candidates) {
    const tag = formatHashtag(candidate);
    if (!tag || seen.has(tagKey(tag)) || !isPoolHashtag(tag)) continue;
    seen.add(tagKey(tag));
    extras.push(tag);
    if (extras.length === DYNAMIC_HASHTAG_COUNT) break;
  }

  if (sameTagSet(extras, previousRandom) && extras.length === DYNAMIC_HASHTAG_COUNT) {
    extras = [];
  }

  extras = fillPoolHashtags(extras, previousRandom);
  const ordered = orderHashtags(candidates, extras, required);
  return asFive(shuffle ? shuffleTags(ordered) : ordered);
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

/** Keep #baanying曼谷 and at most 4 approved-pool extras, preserving order. */
export function ensureRequiredHashtags(tags: string[]): GeneratedHashtags {
  return normalizeHashtags(tags, [], { shuffle: false });
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
