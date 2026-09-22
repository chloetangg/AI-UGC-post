import {
  extractExperienceFacts,
  type ExperienceFact,
} from "@/lib/content-evidence";
import type { CoverTitleContext } from "@/lib/cover/cover-rules";
import { chineseFullDishName } from "@/lib/cover/dish-names";
import { stripGeneratedLocationTime } from "@/lib/locations";
import { neutralizeInventedPartyCopy } from "@/lib/party-size";
import type { RecommendedDish } from "@/types/content";

export const CAPTION_STRUCTURES = ["A", "B", "C", "D", "E", "F"] as const;
export type CaptionStructureId = (typeof CAPTION_STRUCTURES)[number];

export const CAPTION_LENGTH_BANDS = ["short", "medium", "long", "extended"] as const;
export type CaptionLengthBand = (typeof CAPTION_LENGTH_BANDS)[number];

export const CONTENT_FOCUSES = [
  "FOOD",
  "CONVENIENCE",
  "EXPERIENCE",
  "FIRST_VISIT",
  "SHOPPING",
  "SIGNATURE_DISH",
] as const;
export type ContentFocusId = (typeof CONTENT_FOCUSES)[number];
export type CaptionFocusId = ContentFocusId;

export const OPENING_STYLES = [
  "dish-first",
  "shopping-first",
  "experience-first",
  "convenience-first",
  "first-visit-first",
  "owner-first",
] as const;
export type OpeningStyleId = (typeof OPENING_STYLES)[number];

export type GenerationMemory = {
  contentFocus: ContentFocusId;
  openingStyle: OpeningStyleId | string;
  informationPriority: string[];
  dishOrder: string[];
  structureType: string;
  lengthLevel: CaptionLengthBand;
};

export const LENGTH_BAND_RANGE: Record<CaptionLengthBand, { min: number; max: number }> = {
  short: { min: 80, max: 120 },
  medium: { min: 120, max: 180 },
  long: { min: 180, max: 260 },
  extended: { min: 260, max: 330 },
};

export type GenerationVariationPlan = {
  contentFocus: ContentFocusId;
  openingStyle: OpeningStyleId;
  informationPriority: string[];
  selectedFactIds: string[];
  dishOrder: string[];
  structureType: string;
  structureId: CaptionStructureId;
  lengthBand: CaptionLengthBand;
  lengthMin: number;
  lengthMax: number;
  focusId: ContentFocusId;
  coverFocusId: ContentFocusId;
  titleFocuses: [ContentFocusId, ContentFocusId, ContentFocusId];
  memory: GenerationMemory;
};

const STRUCTURE_COPY: Record<ContentFocusId, string> = {
  FOOD: "FOOD — 这家吃什么？ dish → taste/texture → second dish → light restaurant close. Do NOT open from first-visit/mall.",
  CONVENIENCE: "CONVENIENCE — 去这里吃饭方便吗？ mall/pay/menu → dining ease → food last.",
  EXPERIENCE: "EXPERIENCE — 这家有什么特别？ atmosphere/owner/service → overall feel → food last.",
  FIRST_VISIT: "FIRST_VISIT — 第一次来是什么感觉？ first try → restaurant → one or two dishes → close.",
  SHOPPING: "SHOPPING — 逛街顺便吃。 centralwOrld/mall → sit down → food → convenience.",
  SIGNATURE_DISH: "SIGNATURE_DISH — 一道菜讲透。 one dish → why they liked it → one other detail only.",
};

const FOCUS_COPY: Record<ContentFocusId, string> = {
  FOOD: "food / dishes / taste",
  CONVENIENCE: "tourist convenience: pay / Chinese menu / mall dining",
  EXPERIENCE: "restaurant experience: owner / space / service / feel",
  FIRST_VISIT: "first visit at Baan Ying",
  SHOPPING: "mall-stop / centralwOrld shopping then eat",
  SIGNATURE_DISH: "one signature dish in depth",
};

const FOCUS_TO_STRUCTURE: Record<ContentFocusId, CaptionStructureId> = {
  FOOD: "A",
  CONVENIENCE: "C",
  EXPERIENCE: "B",
  FIRST_VISIT: "E",
  SHOPPING: "B",
  SIGNATURE_DISH: "D",
};

const FOCUS_TO_OPENING: Record<ContentFocusId, OpeningStyleId> = {
  FOOD: "dish-first",
  CONVENIENCE: "convenience-first",
  EXPERIENCE: "experience-first",
  FIRST_VISIT: "first-visit-first",
  SHOPPING: "shopping-first",
  SIGNATURE_DISH: "dish-first",
};

const FACT_DESCRIPTIONS: Record<string, string[]> = {
  "handsome-owner": [
    "老板很帅这一点真的很难不注意到，整体用餐氛围也很轻松。",
    "还有一个很容易让人记住的小细节，就是老板很帅。",
    "这顿还有个记忆点，老板本人真的很有印象。",
  ],
  "friendly-owner": ["老板本人很亲切，吃饭时感觉很自然。", "老板很好说话，整个人会放松下来。"],
  "good-service": [
    "店员服务很热情，整个用餐过程都让人觉得很舒服。",
    "服务很到位，吃饭的时候不用自己操心太多。",
  ],
  "mall-stop": ["逛完街之后刚好过来吃，行程上刚刚好。", "逛街后来吃这顿，时间上刚刚好。"],
  comfortable: ["店里坐着很舒服，整个人都放松下来了。", "店里氛围比较放松，适合慢慢吃。"],
  "first-visit": ["第一次来，原本只是想试试看。", "第一次来尝试Baan Ying，没有想太多。"],
  "for-two": ["两个人吃下来很满足。", "两个人来吃，份量刚刚好。"],
  "featured-dish": [],
  "chinese-menu": [
    "店里有中文菜单，点菜不会有太大压力。",
    "有中文菜单，点餐方便很多。",
  ],
  spacious: [
    "店里的空间比想象中大很多，坐下来吃饭不会觉得挤。",
    "餐厅面积很大，坐下来吃饭不会觉得挤。",
  ],
  "mall-chain": ["在购物商场里吃饭，行程上很方便。", "商场里就能吃到泰餐，不用再另找地方。"],
  renovated: ["店里刚刚翻新，环境看着很舒服。", "刚刚翻新过，店里看起来比较新。"],
  variety: ["店里菜品选择很多，点餐不纠结。", "想吃的泰餐基本都点得到。"],
  alipay: ["结账可以用支付宝，付款方便很多。", "对中国游客来说，支付宝也可以使用，付款的时候会方便很多。"],
  "family-friendly": ["很适合带家人一起吃饭，氛围也比较温馨。", "带家人来吃，整体感觉很轻松。"],
  "family-suitable": ["很适合家庭用餐，氛围也比较放松。", "这家吃饭氛围很温馨。"],
  "authentic-taste": [
    "食物整体味道很正宗，吃起来就是很熟悉的泰式风味。",
    "这顿味道很正宗，吃着很满足。",
  ],
  "freshness-room": ["感觉食材的新鲜度还有一点提升空间。", "食材的新鲜度如果再好一点，整体会更完整。"],
};

const MENTION_ONLY = [
  /^(而且)?服务(也)?很好。?$/,
  /^(餐厅|店里)很大。?$/,
  /^有中文菜单。?$/,
  /^食物很好吃。?$/,
  /^(可以)?用支付宝。?$/,
  /^味道正宗。?$/,
  /^环境很好。?$/,
];

const UNNATURAL_STACK =
  /就是.{0,16}感觉|感觉就是|整体就是|其实.{0,8}就是|很好吃体验|方便很多体验|服务热情周到感觉|面积很大环境|菜品选择丰富很好吃|中文菜单游客方便|食材新鲜度感觉/;

const AI_STOCK =
  /整体而言|值得一提的是|不得不说|给人一种|令人印象深刻|可以说是|作为一个|无论是.+还是|如果你也|强烈推荐大家/;

const OPENING_WINDOW = 10;

export function storyCaptionText(caption: string) {
  return stripGeneratedLocationTime(caption).replace(/\s+/g, "").trim();
}

export function storyHanCount(caption: string) {
  return storyCaptionText(caption).match(/\p{Script=Han}/gu)?.length ?? 0;
}

export function detectLengthBand(caption: string): CaptionLengthBand {
  const han = storyHanCount(caption);
  if (han <= 120) return "short";
  if (han <= 180) return "medium";
  if (han <= 260) return "long";
  return "extended";
}

export function evidenceRichness(context: CoverTitleContext = {}) {
  const note = context.diningNote?.trim() ?? "";
  const enjoy = (context.enjoyMost ?? []).filter((item) => item && item !== "其他");
  const dishes = (context.dishes ?? []).filter((item) => item && item !== "Others");
  const reasons = (context.recommendTo ?? []).filter((item) => item && item !== "其他");
  let score = enjoy.length + dishes.length + Math.min(reasons.length, 3);
  if (note.length >= 24) score += 2;
  else if (note.length > 0) score += 1;
  if (typeof context.mealAmount === "number" && context.mealAmount > 0) score += 1;
  return score;
}

function selectedDishNames(context: CoverTitleContext) {
  return (context.dishes ?? [])
    .filter((item) => item && item !== "Others")
    .map((item) => chineseFullDishName(item as RecommendedDish) || item)
    .filter(Boolean);
}

function dishFactId(name: string) {
  return `dish:${name}`;
}

function dishFactsFromContext(context: CoverTitleContext): ExperienceFact[] {
  const reasons = (context.recommendTo ?? []).filter((item) => item && item !== "其他");
  return selectedDishNames(context).map((name) => {
    const matched = reasons.find((reason) => reason.includes(name) || name.includes(reason.replace(/[^\u4e00-\u9fffA-Za-z]/g, "").slice(0, 2)));
    const detail = matched
      ? matched.includes(name)
        ? matched.replace(name, "").replace(/^[，,、\s]+/, "")
        : matched
      : "";
    return {
      id: dishFactId(name),
      kind: "food",
      hookType: "food",
      markers: [name],
      coverMains: [name],
      coverSubs: [`这口${name}很香`],
      titleHooks: [`曼谷泰餐${name}很满足`],
      captionLine: detail
        ? `${name}${detail}，吃起来很有记忆点。`.replace(/，+/g, "，")
        : `${name}很好吃，吃完还想再点。`,
    };
  });
}

function workingFacts(context: CoverTitleContext) {
  const extracted = extractExperienceFacts(context);
  const dishes = dishFactsFromContext(context);
  if (dishes.length === 0) return extracted;
  return [...dishes, ...extracted.filter((fact) => fact.id !== "featured-dish")];
}

function resolveFactId(item: string, facts: ExperienceFact[]) {
  if (facts.some((fact) => fact.id === item)) return item;
  const dish = facts.find((fact) => fact.id === dishFactId(item) || fact.markers.includes(item));
  return dish?.id;
}

export function availableContentFocuses(context: CoverTitleContext = {}, facts: ExperienceFact[] = []) {
  const enjoy = (context.enjoyMost ?? []).join(" ");
  const note = context.diningNote?.trim() ?? "";
  const dishes = selectedDishNames(context);
  const focuses: ContentFocusId[] = [];
  if (dishes.length > 0 || facts.some((fact) => fact.kind === "food") || /正宗|好吃/.test(`${enjoy}${note}`)) {
    focuses.push("FOOD");
  }
  if (dishes.length > 0) focuses.push("SIGNATURE_DISH");
  if (
    facts.some((fact) => fact.id === "chinese-menu" || fact.id === "alipay") ||
    /中文菜单|支付宝/.test(`${enjoy}${note}`) ||
    context.customerType === "Tourist"
  ) {
    focuses.push("CONVENIENCE");
  }
  if (
    facts.some((fact) =>
      ["handsome-owner", "friendly-owner", "good-service", "comfortable", "spacious", "renovated"].includes(fact.id),
    ) ||
    /老板|环境|舒服|服务/.test(`${enjoy}${note}`)
  ) {
    focuses.push("EXPERIENCE");
  }
  if (facts.some((fact) => fact.id === "first-visit") || /1st time/i.test(context.visitFrequency ?? "") || /第一次/.test(note)) {
    focuses.push("FIRST_VISIT");
  }
  if (
    facts.some((fact) => fact.id === "mall-stop" || fact.id === "mall-chain") ||
    /商场|逛/.test(`${enjoy}${note}`)
  ) {
    focuses.push("SHOPPING");
  }
  return focuses.length > 0 ? focuses : (["EXPERIENCE"] as ContentFocusId[]);
}

function pickRotated<T>(items: T[], seed: number, avoid?: T) {
  if (items.length === 0) return undefined;
  const pool = avoid && items.length > 1 ? items.filter((item) => item !== avoid) : items;
  return pool[Math.abs(seed) % pool.length];
}

function allowedLengthBands(richness: number): CaptionLengthBand[] {
  if (richness <= 2) return ["short", "medium"];
  if (richness <= 5) return ["short", "medium", "long"];
  return ["medium", "long", "extended"];
}

export function detectContentFocus(text: string, facts: ExperienceFact[] = []): ContentFocusId {
  const opening = storyCaptionText(text).replace(/[\p{Extended_Pictographic}]/gu, "").slice(0, 22);
  if (/^第一次来|^第一次来到|原本只是想试试看/.test(opening)) return "FIRST_VISIT";
  if (/^在centralwOrld|^逛|逛街|商场里/.test(opening)) return "SHOPPING";
  if (/支付宝|中文菜单|对游客来说|吃饭方便|方便程度/.test(opening)) return "CONVENIENCE";
  if (/老板|环境|轻松的用餐|最喜欢的是那种|用餐时的感觉|很容易让人记住的小细节/.test(opening)) return "EXPERIENCE";
  if (/最想推荐的是|这道真的可以单独|还是/.test(opening) && /虾|咖喱|饭|菜/.test(opening)) return "SIGNATURE_DISH";
  if (facts.some((fact) => fact.kind === "food" && fact.markers.some((marker) => opening.includes(marker)))) {
    return "FOOD";
  }
  return "FOOD";
}

export function openingFamily(caption: string) {
  const opening = storyCaptionText(caption).replace(/[\p{Extended_Pictographic}]/gu, "").slice(0, 22);
  if (/第一次来|第一次来到|原本只是想/.test(opening)) return "first-visit-first";
  if (/逛|centralwOrld逛|商场/.test(opening)) return "shopping-first";
  if (/支付宝|中文菜单|方便程度|对游客|吃饭方便/.test(opening)) return "convenience-first";
  if (/老板|环境|轻松|用餐感觉|用餐时的感觉|很容易让人记住的小细节/.test(opening)) return "experience-first";
  if (/最想推荐|蒜炒|咖喱|虾仁|这道|比较想说的还是吃/.test(opening)) return "dish-first";
  return "other";
}

function detectOpening(caption: string) {
  const story = storyCaptionText(caption).replace(/[\p{Extended_Pictographic}]/gu, "");
  return story.slice(0, OPENING_WINDOW);
}

function factOrder(caption: string, facts: ExperienceFact[]) {
  const hits: string[] = [];
  for (const fact of facts) {
    const at = fact.markers.reduce((min, marker) => {
      const index = marker ? caption.indexOf(marker) : -1;
      return index >= 0 && (min < 0 || index < min) ? index : min;
    }, -1);
    if (at >= 0) hits.push(`${at}:${fact.id}`);
  }
  return hits.sort().map((item) => item.split(":")[1]);
}

function factPriorityForFocus(
  focus: ContentFocusId,
  facts: ExperienceFact[],
  dishes: string[],
  seed: number,
): string[] {
  const has = (id: string) => facts.some((fact) => fact.id === id);
  void seed;
  switch (focus) {
    case "FOOD":
      return [...dishes, ...["featured-dish", "authentic-taste", "variety", "comfortable"].filter(has)];
    case "SIGNATURE_DISH":
      return [...dishes.slice(0, 1), "featured-dish", ...["authentic-taste", "good-service"].filter(has)];
    case "CONVENIENCE":
      return [...["chinese-menu", "alipay", "mall-chain"].filter(has), ...dishes.slice(0, 1)];
    case "EXPERIENCE":
      return [
        ...["handsome-owner", "friendly-owner", "comfortable", "spacious", "good-service", "renovated"].filter(has),
        ...dishes.slice(0, 1),
      ];
    case "FIRST_VISIT":
      return ["first-visit", ...["handsome-owner", "good-service", "comfortable"].filter(has), ...dishes.slice(0, 2)];
    case "SHOPPING":
      return [...["mall-stop", "mall-chain", "alipay", "chinese-menu"].filter(has), ...dishes.slice(0, 1)];
    default:
      return facts.map((fact) => fact.id);
  }
}

export function planGenerationVariation(input: {
  context?: CoverTitleContext;
  variantIndex?: number;
  previousCaption?: string;
  previousCoverTitle?: string;
  previousTitles?: string[];
  previousMemories?: GenerationMemory[];
}): GenerationVariationPlan {
  const context = input.context ?? {};
  const facts = workingFacts(context);
  const focuses = availableContentFocuses(context, facts);
  const seed = input.variantIndex ?? 0;
  const memories = (input.previousMemories ?? []).slice(-3);
  const previousCaption = input.previousCaption ?? "";
  const usedFocuses = new Set(
    [
      ...memories.map((item) => item.contentFocus),
      previousCaption ? detectContentFocus(previousCaption, facts) : undefined,
    ].filter((item): item is ContentFocusId => Boolean(item)),
  );
  const usedOpenings = new Set(memories.map((item) => item.openingStyle));
  const usedLengths = new Set(memories.map((item) => item.lengthLevel));
  const usedPriorities = new Set(memories.map((item) => item.informationPriority.join(">")));
  const usedDishOrders = new Set(memories.map((item) => item.dishOrder.join(">")));

  const freshFocuses = focuses.filter((item) => !usedFocuses.has(item));
  const focusPool = freshFocuses.length > 0 ? freshFocuses : focuses.filter((item) => item !== memories.at(-1)?.contentFocus);
  const contentFocus = pickRotated(focusPool.length ? focusPool : focuses, seed + 3) ?? focuses[0] ?? "EXPERIENCE";

  const dishes = selectedDishNames(context);
  let dishOrder = dishes.slice();
  if (dishOrder.length > 1) {
    const rotated = [...dishOrder.slice(seed % dishOrder.length), ...dishOrder.slice(0, seed % dishOrder.length)];
    dishOrder = usedDishOrders.has(rotated.join(">")) && dishOrder.length > 1 ? [...dishOrder].reverse() : rotated;
  }

  let informationPriority = factPriorityForFocus(contentFocus, facts, dishOrder, seed)
    .filter((item) => Boolean(resolveFactId(item, facts)));
  if (usedPriorities.has(informationPriority.join(">")) && informationPriority.length > 1) {
    informationPriority = [...informationPriority.slice(1), informationPriority[0]!];
  }
  const selectedFactIds = [...new Set(informationPriority.map((item) => resolveFactId(item, facts)).filter((id): id is string => Boolean(id)))]
    .slice(0, contentFocus === "SIGNATURE_DISH" ? 3 : 5);

  const openingStyle =
    pickRotated(
      OPENING_STYLES.filter((item) => !usedOpenings.has(item) && (
        (contentFocus === "FOOD" && item === "dish-first") ||
        (contentFocus === "SIGNATURE_DISH" && item === "dish-first") ||
        (contentFocus === "SHOPPING" && item === "shopping-first") ||
        (contentFocus === "EXPERIENCE" && (item === "experience-first" || item === "owner-first")) ||
        (contentFocus === "CONVENIENCE" && item === "convenience-first") ||
        (contentFocus === "FIRST_VISIT" && item === "first-visit-first")
      )),
      seed,
    ) ?? FOCUS_TO_OPENING[contentFocus];

  const bands = allowedLengthBands(evidenceRichness(context));
  const previousBand = memories.at(-1)?.lengthLevel ?? (previousCaption ? detectLengthBand(previousCaption) : undefined);
  const lengthBand =
    pickRotated(bands.filter((item) => !usedLengths.has(item) && item !== previousBand), seed + 13) ??
    pickRotated(bands, seed + 13, previousBand) ??
    bands[0];
  const range = LENGTH_BAND_RANGE[lengthBand];
  const structureType = STRUCTURE_COPY[contentFocus].split("—")[1]?.trim().split(".")[0] ?? contentFocus;
  const coverPool = focuses.filter((item) => item !== contentFocus);
  const coverFocusId = pickRotated(coverPool.length ? coverPool : focuses, seed + 11) ?? contentFocus;
  const titleFocuses: [ContentFocusId, ContentFocusId, ContentFocusId] = [
    contentFocus,
    pickRotated(focuses.filter((item) => item !== contentFocus), seed + 5) ?? contentFocus,
    pickRotated(focuses.filter((item) => item !== contentFocus && item !== coverFocusId), seed + 9) ?? coverFocusId,
  ];
  const memory: GenerationMemory = {
    contentFocus,
    openingStyle,
    informationPriority,
    dishOrder,
    structureType,
    lengthLevel: lengthBand,
  };

  return {
    contentFocus,
    openingStyle,
    informationPriority,
    selectedFactIds,
    dishOrder,
    structureType,
    structureId: FOCUS_TO_STRUCTURE[contentFocus],
    lengthBand,
    lengthMin: range.min,
    lengthMax: range.max,
    focusId: contentFocus,
    coverFocusId,
    titleFocuses,
    memory,
  };
}

export function formatGenerationVariationRules(plan: GenerationVariationPlan, memories: GenerationMemory[] = []) {
  const memoryBlock = memories.length
    ? `RECENT GENERATION MEMORY (do not reuse these contentFocus / openingStyle / informationPriority / dishOrder / structureType / lengthLevel):
${memories
  .map(
    (item, index) =>
      `Generation ${index + 1}: contentFocus=${item.contentFocus}; openingStyle=${item.openingStyle}; informationPriority=${item.informationPriority.join(" → ") || "none"}; dishOrder=${item.dishOrder.join(" → ") || "none"}; structureType=${item.structureType}; lengthLevel=${item.lengthLevel}`,
  )
  .join("\n")}

`
    : "";
  return `${memoryBlock}THIS ROUND INDEPENDENT DRAFT — Regenerate ≠ rewrite. Choose a new Content Focus, new information mix (2–5 points), new order, new opening, new length.

Do NOT cover every customer point every time. Do NOT swap synonyms on the last post.

THIS ROUND CONTENT FOCUS: ${plan.contentFocus} — ${FOCUS_COPY[plan.contentFocus]}
${STRUCTURE_COPY[plan.contentFocus]}
THIS ROUND OPENING STYLE: ${plan.openingStyle}. The first sentence MUST match this style. Do not reuse the previous opening family (第一次来到 centralwOrld… / 逛完 centralwOrld…).
THIS ROUND INFORMATION PRIORITY (describe these 2–5 only; skip the rest): ${plan.informationPriority.join(" → ") || "none"}
THIS ROUND DISH ORDER: ${plan.dishOrder.join(" → ") || "none"}
THIS ROUND LENGTH: ${plan.lengthBand} ≈ ${plan.lengthMin}–${plan.lengthMax} Chinese characters.
THIS ROUND TITLE ANGLES: Title 1 = ${plan.titleFocuses[0]}; Title 2 = ${plan.titleFocuses[1]}; Title 3 = ${plan.titleFocuses[2]}.
THIS ROUND COVER: mainTitle from ${plan.coverFocusId}; subTitle from a DIFFERENT real point.
Do not reuse the previous opening family, dish order, or informationPriority.
If the customer gave little evidence, stay in a shorter allowed band — never invent to hit Long / Extended.
Describe the chosen 2–5 points; do not average-cover every selected tag.

BAD: listing every enjoy-most tag. BAD: 服务很好。
GOOD: 2–5 complete sentences that serve THIS focus only.

CHINESE NATURALNESS: Write complete sentences. Do not glue keywords.
BAD: 就是食材新鲜度感觉提升空间 / 服务热情周到感觉很好 / 中文菜单游客方便很多体验
GOOD: 感觉食材的新鲜度还有一点提升空间。 / 店员服务很热情，整个用餐过程都让人觉得很舒服。
Keep the customer's sentiment. 食物味道正宗美味 must stay positive. Do not add 提升空间 unless they wrote it.
Do not spray 就是 / 感觉 / 其实 / 整体 / 体验 to fake spoken tone.
Avoid AI stock unless they wrote it: 整体而言 / 值得一提的是 / 不得不说 / 给人一种 / 令人印象深刻 / 可以说是 / 作为一个 / 无论是…还是… / 如果你也… / 强烈推荐大家…
Prefer lived phrasing only when it fits the evidence: 这次比较喜欢的是 / 我自己最喜欢 / 没想到 / 对游客来说 / 这一点还蛮方便的 / 吃下来觉得 / 比较让我满意的是 / 如果第一次来 / 这次最想推荐的是.

Variation must NOT invent dishes, prices, promos, service, atmosphere, feelings, places, ingredients, restaurant traits, party size, or companions that are not in the customer input or confirmed restaurant data.
If they did not write who they dined with, use 这次来吃 / 这顿吃下来. Never 两个人 / 和朋友 / 一家三口 / 带家人 / 一个人来 from dish count, photos, or spend.`;
}

function factDescribed(text: string, fact: ExperienceFact) {
  if (MENTION_ONLY.some((pattern) => pattern.test(text.trim()))) return false;
  const hay = text.replace(/\s+/g, "");
  if (!fact.markers.some((marker) => marker && hay.includes(marker))) return false;
  return (
    hay.length >= 12 ||
    /很|比较|不会|方便|舒服|热情|压力|风味|正宗|轻松|挤|局促/.test(hay)
  );
}

function descriptionFor(
  fact: ExperienceFact,
  context: CoverTitleContext,
  seed: number,
) {
  const variants = [...(FACT_DESCRIPTIONS[fact.id] ?? [])];
  if ((fact.id === "featured-dish" || fact.id.startsWith("dish:")) && fact.markers[0]) {
    variants.unshift(
      fact.captionLine,
      `${fact.markers[0]}很好吃，吃完还想再点。`,
      `这次比较想推荐的是${fact.markers[0]}，味道很合口味。`,
    );
  }
  if (fact.id === "alipay" && context.customerType === "Tourist") {
    return variants[1] ?? variants[0] ?? fact.captionLine;
  }
  if (fact.id === "chinese-menu" && (context.visitFrequency === "1st time" || context.customerType === "Tourist")) {
    return "对第一次来吃饭的人来说，有中文菜单真的方便很多。";
  }
  if (variants.length === 0) return fact.captionLine;
  return variants[Math.abs(seed) % variants.length] ?? fact.captionLine;
}

function splitSentences(caption: string) {
  const story = stripGeneratedLocationTime(caption).trim();
  if (!story) return [];
  return story
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinSentences(sentences: string[]) {
  const seen = new Set<string>();
  return sentences
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return "";
      return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
    })
    .filter((sentence) => {
      if (!sentence) return false;
      if (MENTION_ONLY.some((pattern) => pattern.test(sentence))) return false;
      if (/来曼谷当然要安排/.test(sentence)) return false;
      const key = sentence.replace(/[\p{Extended_Pictographic}]/gu, "").slice(0, 10);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("");
}

function customerAllowsDowngrade(context: CoverTitleContext) {
  return /提升空间|一般|普通|不够|有点咸|不太/.test(context.diningNote ?? "");
}

export function hasUnnaturalChinese(text: string) {
  const story = stripGeneratedLocationTime(text);
  if (UNNATURAL_STACK.test(story) || AI_STOCK.test(story)) return true;
  return splitSentences(story).some((sentence) => {
    const clean = sentence.replace(/[\p{Extended_Pictographic}📍⏰#]/gu, "").trim();
    if (clean.length < 6) return false;
    if (/[。！？!?，、]/.test(clean) === false && /感觉$|体验$|空间$/.test(clean)) return true;
    return /就是.{2,14}感觉/.test(clean);
  });
}

function polishSentence(sentence: string, context: CoverTitleContext, facts: ExperienceFact[], seed: number) {
  let next = sentence.trim();
  const replacements: Array<[RegExp, string, boolean?]> = [
    [/就是食材新鲜度感觉提升空间/g, "感觉食材的新鲜度还有一点提升空间", true],
    [/食材新鲜度感觉提升空间/g, "感觉食材的新鲜度还有一点提升空间", true],
    [/整体就是服务感觉很好/g, "整体来说，服务还是很不错的"],
    [/其实环境就是很大体验不错/g, "餐厅空间很大，整体环境也比较舒服"],
    [/感觉就是菜品选择丰富/g, "店里菜品选择比较多，点餐不纠结"],
    [/服务热情周到感觉很好/g, "店员服务很热情，整个用餐过程都让人觉得很舒服"],
    [/餐厅面积很大环境很舒服感觉/g, "店里空间很大，坐下来吃饭也比较舒服"],
    [/菜品选择丰富很好吃体验/g, "菜品选择比较多，吃下来味道也不错"],
    [/中文菜单游客方便很多体验/g, "店里有中文菜单，点菜方便很多"],
    [/值得一提的是/g, ""],
    [/不得不说，?/g, ""],
    [/整体而言，?/g, ""],
    [/令人印象深刻的是/g, "比较让我满意的是"],
    [/强烈推荐大家来/g, "如果还没吃过可以来试试"],
  ];
  for (const [pattern, replacement, needsDowngrade] of replacements) {
    if (needsDowngrade && !customerAllowsDowngrade(context)) continue;
    next = next.replace(pattern, replacement);
  }
  if (MENTION_ONLY.some((pattern) => pattern.test(next.replace(/[。！？!?]/g, "。")))) {
    const fact = facts.find((item) => item.markers.some((marker) => marker && next.includes(marker)));
    if (fact) return descriptionFor(fact, context, seed);
  }
  return next.replace(/\s{2,}/g, "").trim();
}

function preserveSentiment(caption: string, context: CoverTitleContext) {
  const enjoy = (context.enjoyMost ?? []).join(" ");
  if (/食物味道正宗美味|味道正宗/.test(enjoy) && /提升空间/.test(caption) && !customerAllowsDowngrade(context)) {
    return caption.replace(/[^。！？!?]*提升空间[^。！？!?]*/g, "食物整体味道很正宗，吃起来就是很熟悉的泰式风味");
  }
  if (customerAllowsDowngrade(context) && /食材/.test(context.diningNote ?? "") && /非常新鲜|很新鲜/.test(caption)) {
    return caption.replace(/[^。！？!?]*很(非常)?新鲜[^。！？!?]*/g, "感觉食材的新鲜度还有一点提升空间");
  }
  return caption;
}

function uniqueFacts(facts: ExperienceFact[]) {
  const next: ExperienceFact[] = [];
  for (const fact of facts) {
    if (!next.some((item) => item.id === fact.id)) next.push(fact);
  }
  return next;
}

function structureFactOrder(facts: ExperienceFact[], plan: GenerationVariationPlan) {
  const selected = plan.selectedFactIds
    .map((id) => facts.find((fact) => fact.id === id))
    .filter((fact): fact is ExperienceFact => Boolean(fact));
  if (selected.length > 0) return uniqueFacts(selected);
  return uniqueFacts(facts).slice(0, 3);
}

function targetFactCount(plan: GenerationVariationPlan, available: number) {
  const wanted =
    plan.lengthBand === "short" ? 2 : plan.lengthBand === "medium" ? 3 : plan.lengthBand === "long" ? 4 : 5;
  return Math.max(1, Math.min(available, wanted));
}

function openingFor(
  plan: GenerationVariationPlan,
  context: CoverTitleContext,
  facts: ExperienceFact[],
  seed: number,
) {
  const firstVisit = facts.some((fact) => fact.id === "first-visit");
  const dish = plan.dishOrder[0] || facts.find((fact) => fact.id === "featured-dish")?.markers[0] || "";
  const hasOwner = facts.some((fact) => fact.id === "handsome-owner" || fact.id === "friendly-owner");
  const tourist = context.customerType === "Tourist";
  switch (plan.openingStyle) {
    case "dish-first":
      return dish ? `这次最想推荐的还是${dish}。` : "这次比较想说的还是吃的。";
    case "shopping-first":
      return facts.some((fact) => fact.id === "mall-stop")
        ? "在centralwOrld逛了一圈，想找一家泰餐吃饭，最后选了Baan Ying。"
        : "在centralwOrld想找一家泰餐吃饭，最后选了Baan Ying。";
    case "experience-first":
      return hasOwner
        ? "这次来Baan Ying，最容易记住的还是用餐时的感觉。"
        : "这次来Baan Ying，最喜欢的是那种很轻松的用餐感觉。";
    case "convenience-first":
      if (facts.some((fact) => fact.id === "mall-stop" || fact.id === "mall-chain")) {
        return "在曼谷逛商场的时候，找到一家吃饭方便的泰餐其实还蛮重要的。";
      }
      return tourist
        ? "对来曼谷吃饭的人来说，方便程度其实也很重要。"
        : "这顿比较让我省心的，是吃饭本身很方便。";
    case "first-visit-first":
      return firstVisit
        ? "第一次来Baan Ying，原本只是想简单试试看，结果有几道菜还蛮有记忆点。"
        : "这次来Baan Ying吃泰餐。";
    case "owner-first":
      return hasOwner ? "还有一个很容易让人记住的小细节，就是老板很帅。" : "先说这家店比较让我记得住的地方。";
    default:
      return "这顿吃下来，有几个点印象比较深。";
  }
}

function rebuildCaption(
  context: CoverTitleContext,
  facts: ExperienceFact[],
  plan: GenerationVariationPlan,
  seed: number,
) {
  const ordered = structureFactOrder(facts, plan);
  const unique: ExperienceFact[] = [];
  for (const fact of ordered) {
    if (!unique.some((item) => item.id === fact.id)) unique.push(fact);
  }
  const chosen = unique.slice(0, targetFactCount(plan, unique.length));
  const sentences = [openingFor(plan, context, facts, seed)];
  for (const [index, fact] of chosen.entries()) {
    const alreadyOpened =
      (fact.id === "first-visit" && /第一次/.test(sentences[0] ?? "")) ||
      (fact.id === "handsome-owner" && plan.openingStyle === "owner-first" && /老板/.test(sentences[0] ?? ""));
    if (alreadyOpened) continue;
    const line = descriptionFor(fact, context, seed + index);
    if (!sentences.some((sentence) => sentence.includes(line.slice(0, 6)))) sentences.push(line);
  }
  if (
    plan.contentFocus === "EXPERIENCE" &&
    chosen.length >= 2 &&
    facts.some((fact) => fact.id === "comfortable" || fact.id === "good-service" || fact.id === "spacious")
  ) {
    sentences.push("吃下来整体还比较舒服。");
  }
  return joinSentences(sentences);
}

function expandMentionOnly(
  caption: string,
  context: CoverTitleContext,
  facts: ExperienceFact[],
  plan: GenerationVariationPlan,
  seed: number,
) {
  const sentences = splitSentences(caption).map((sentence, index) =>
    polishSentence(sentence, context, facts, seed + index),
  );
  const used = new Set(
    facts.filter((fact) => sentences.some((sentence) => factDescribed(sentence, fact))).map((fact) => fact.id),
  );
  const needed = targetFactCount(plan, facts.length);
  const extras = structureFactOrder(facts, plan).filter((fact) => !used.has(fact.id));
  for (const fact of extras) {
    if (used.size >= needed) break;
    sentences.push(descriptionFor(fact, context, seed + used.size));
    used.add(fact.id);
  }
  return joinSentences(sentences);
}

function trimToBand(caption: string, plan: GenerationVariationPlan) {
  if (storyHanCount(caption) <= plan.lengthMax) return caption;
  const sentences = splitSentences(caption);
  while (sentences.length > 2 && storyHanCount(joinSentences(sentences)) > plan.lengthMax) {
    sentences.pop();
  }
  return joinSentences(sentences);
}

function expandToBand(
  caption: string,
  context: CoverTitleContext,
  facts: ExperienceFact[],
  plan: GenerationVariationPlan,
  seed: number,
) {
  let next = caption;
  if (storyHanCount(next) >= plan.lengthMin) return next;
  for (const [index, fact] of structureFactOrder(facts, plan).entries()) {
    if (storyHanCount(next) >= plan.lengthMin) break;
    if (fact.markers.some((marker) => marker && next.includes(marker))) continue;
    next = joinSentences([...splitSentences(next), descriptionFor(fact, context, seed + index)]);
  }
  return joinSentences(splitSentences(next));
}

function jaccardBigrams(a: string, b: string) {
  const grams = (text: string) => {
    const clean = storyCaptionText(text).replace(/[\p{Extended_Pictographic}]/gu, "");
    const set = new Set<string>();
    for (let index = 0; index < clean.length - 1; index += 1) set.add(clean.slice(index, index + 2));
    return set;
  };
  const left = grams(a);
  const right = grams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

export function isCaptionTooSimilar(current: string, previous: string, facts: ExperienceFact[] = []) {
  if (!previous.trim() || !current.trim()) return false;
  const currentStory = stripGeneratedLocationTime(current);
  const previousStory = stripGeneratedLocationTime(previous);
  if (detectOpening(currentStory) === detectOpening(previousStory)) return true;
  if (Math.abs(storyHanCount(currentStory) - storyHanCount(previousStory)) < 12) {
    if (jaccardBigrams(currentStory, previousStory) >= 0.62) return true;
  }
  const currentOrder = factOrder(currentStory, facts).join(">");
  const previousOrder = factOrder(previousStory, facts).join(">");
  if (currentOrder && currentOrder === previousOrder && jaccardBigrams(currentStory, previousStory) >= 0.5) {
    return true;
  }
  return jaccardBigrams(currentStory, previousStory) >= 0.72;
}

function titleCore(title: string) {
  return title
    .replace(/[\p{Extended_Pictographic}]/gu, "")
    .replace(/centralwOrld/g, "")
    .replace(/曼谷(美食推荐|美食攻略|吃什么|探店|泰餐|泰菜|餐厅|吃饭|美食)/g, "")
    .replace(/[，。！？、：:｜|\s]/g, "");
}

export function titlesLackVariation(titles: string[], facts: ExperienceFact[] = []) {
  if (titles.length < 3) return true;
  const cores = titles.map(titleCore);
  if (cores[0] && cores[0] === cores[1] && cores[1] === cores[2]) return true;
  const factHits = titles.map((title) => facts.filter((fact) => fact.markers.some((marker) => marker && title.includes(marker))).map((fact) => fact.id));
  const shared = factHits[0]?.filter((id) => factHits.every((list) => list.includes(id))) ?? [];
  if (shared.length > 0 && factHits.every((list) => list.length <= 1) && facts.length >= 3) return true;
  const colonCount = titles.filter((title) => /[:：]/.test(title)).length;
  return colonCount === 3;
}

export function coverTooSimilar(currentTitle: string, currentSub: string, previousCover = "") {
  if (!previousCover.trim()) return false;
  const previousMain = previousCover.split("/")[0]?.trim() ?? "";
  const previousSub = previousCover.split("/")[1]?.trim() ?? "";
  if (previousMain && currentTitle.replace(/\s+/g, "") === previousMain.replace(/\s+/g, "")) return true;
  if (previousSub && currentSub && jaccardBigrams(currentSub, previousSub) >= 0.8) return true;
  return false;
}

function rotateTitles(
  titles: [string, string, string],
  facts: ExperienceFact[],
  plan: GenerationVariationPlan,
) {
  if (!titlesLackVariation(titles, facts) || facts.length === 0) return titles;
  const next: [string, string, string] = [titles[0], titles[1], titles[2]];
  const used = new Set<string>();
  const hooks = facts.flatMap((fact) => fact.titleHooks);
  for (let index = 0; index < next.length; index += 1) {
    const hook = hooks.find((item) => item && !used.has(item) && !next.includes(item));
    if (!hook) continue;
    used.add(hook);
    const keepFlag = next[index].trimStart().startsWith("🇹🇭");
    next[index] = `${keepFlag ? "🇹🇭" : ""}${hook}`;
  }
  return next;
}

function rotateCover(
  coverTitle: string,
  coverSubtitle: string,
  previousCover: string,
  facts: ExperienceFact[],
) {
  if (!coverTooSimilar(coverTitle, coverSubtitle, previousCover) || facts.length < 2) {
    return { coverTitle, coverSubtitle };
  }
  const alt = facts.find((fact) => !fact.markers.some((marker) => marker && coverTitle.includes(marker)));
  if (!alt) return { coverTitle, coverSubtitle };
  return {
    coverTitle: coverTitle,
    coverSubtitle: alt.coverSubs[0] ?? coverSubtitle,
  };
}

export function evaluateGenerationVariation(input: {
  titles: [string, string, string];
  caption: string;
  coverTitle: string;
  coverSubtitle: string;
  plan: GenerationVariationPlan;
  context?: CoverTitleContext;
  previousCaption?: string;
  previousCoverTitle?: string;
}) {
  const context = input.context ?? {};
  const facts = workingFacts(context);
  const caption = stripGeneratedLocationTime(input.caption);
  const reasons: string[] = [];
  if (input.previousCaption && isCaptionTooSimilar(caption, input.previousCaption, facts)) {
    reasons.push("caption-similar");
  }
  if (titlesLackVariation(input.titles, facts)) reasons.push("title-similar");
  if (coverTooSimilar(input.coverTitle, input.coverSubtitle, input.previousCoverTitle)) {
    reasons.push("cover-similar");
  }
  if (hasUnnaturalChinese(caption)) reasons.push("unnatural");
  const planned = input.plan.selectedFactIds.length
    ? facts.filter((fact) => input.plan.selectedFactIds.includes(fact.id))
    : facts.slice(0, 3);
  const covered = planned.filter((fact) => splitSentences(caption).some((sentence) => factDescribed(sentence, fact)));
  if (planned.length >= 2 && covered.length < 1) reasons.push("thin-coverage");
  if (input.previousCaption) {
    if (openingFamily(caption) === openingFamily(input.previousCaption)) reasons.push("same-opening-family");
    if (detectContentFocus(caption, facts) === detectContentFocus(input.previousCaption, facts)) {
      reasons.push("same-focus");
    }
    const currentOrder = factOrder(caption, facts).join(">");
    const previousOrder = factOrder(input.previousCaption, facts).join(">");
    if (currentOrder && currentOrder === previousOrder) reasons.push("same-info-order");
  }
  const han = storyHanCount(caption);
  const richness = evidenceRichness(context);
  if (richness >= 3 && han + 18 < input.plan.lengthMin) reasons.push("too-short");
  if (han > input.plan.lengthMax + 24) reasons.push("too-long");
  return { ok: reasons.length === 0, reasons, facts };
}

export function ensureGenerationVariation(input: {
  titles: [string, string, string];
  caption: string;
  coverTitle: string;
  coverSubtitle: string;
  plan: GenerationVariationPlan;
  context?: CoverTitleContext;
  previousCaption?: string;
  previousCoverTitle?: string;
  previousTitles?: string[];
  previousMemories?: GenerationMemory[];
  variantIndex?: number;
}) {
  const context = input.context ?? {};
  const facts = workingFacts(context);
  const seed = input.variantIndex ?? 0;
  let activePlan = input.plan;
  let titles = rotateTitles(input.titles, facts, input.plan);
  let cover = rotateCover(input.coverTitle, input.coverSubtitle, input.previousCoverTitle ?? "", facts);
  let caption = stripGeneratedLocationTime(input.caption);
  const shouldRebuild =
    Boolean(input.previousCaption) ||
    Boolean(input.previousMemories?.length) ||
    detectContentFocus(caption, facts) !== input.plan.contentFocus ||
    openingFamily(caption) !== input.plan.openingStyle;
  if (shouldRebuild) {
    caption = rebuildCaption(context, facts, input.plan, seed);
  } else {
    caption = expandMentionOnly(caption, context, facts, input.plan, seed);
  }
  caption = joinSentences(
    splitSentences(caption).map((sentence, index) => polishSentence(sentence, context, facts, seed + index)),
  );
  caption = preserveSentiment(caption, context);
  caption = expandToBand(caption, context, facts, input.plan, seed);
  caption = joinSentences(splitSentences(trimToBand(caption, input.plan)));

  let verdict = evaluateGenerationVariation({
    ...input,
    titles,
    caption,
    coverTitle: cover.coverTitle,
    coverSubtitle: cover.coverSubtitle,
  });

  if (
    input.previousCaption &&
    (verdict.reasons.includes("caption-similar") ||
      verdict.reasons.includes("thin-coverage") ||
      verdict.reasons.includes("same-opening-family") ||
      verdict.reasons.includes("same-focus") ||
      verdict.reasons.includes("same-info-order"))
  ) {
    caption = rebuildCaption(context, facts, input.plan, seed + 21);
    caption = preserveSentiment(caption, context);
    caption = expandToBand(caption, context, facts, input.plan, seed + 21);
    caption = joinSentences(splitSentences(trimToBand(caption, input.plan)));
    verdict = evaluateGenerationVariation({
      ...input,
      titles,
      caption,
      coverTitle: cover.coverTitle,
      coverSubtitle: cover.coverSubtitle,
    });
  }

  if (Boolean(input.previousCaption) && verdict.reasons.includes("caption-similar")) {
    const retryPlan = planGenerationVariation({
      context,
      variantIndex: seed + 17,
      previousCaption: input.previousCaption,
      previousCoverTitle: input.previousCoverTitle,
      previousTitles: input.previousTitles,
      previousMemories: input.previousMemories,
    });
    activePlan = retryPlan;
    caption = rebuildCaption(context, facts, retryPlan, seed + 99);
    caption = preserveSentiment(caption, context);
    caption = expandToBand(caption, context, facts, retryPlan, seed + 99);
    caption = joinSentences(splitSentences(trimToBand(caption, retryPlan)));
    titles = rotateTitles(titles, facts, retryPlan);
    cover = rotateCover(cover.coverTitle, cover.coverSubtitle, input.previousCoverTitle ?? "", facts);
    verdict = evaluateGenerationVariation({
      ...input,
      plan: retryPlan,
      titles,
      caption,
      coverTitle: cover.coverTitle,
      coverSubtitle: cover.coverSubtitle,
    });
  }

  return {
    titles: [
      neutralizeInventedPartyCopy(titles[0], context),
      neutralizeInventedPartyCopy(titles[1], context),
      neutralizeInventedPartyCopy(titles[2], context),
    ] as [string, string, string],
    caption: neutralizeInventedPartyCopy(caption, context),
    coverTitle: neutralizeInventedPartyCopy(cover.coverTitle, context),
    coverSubtitle: neutralizeInventedPartyCopy(cover.coverSubtitle, context),
    needsRetry: false,
    reasons: verdict.reasons,
    memory: activePlan.memory,
  };
}
