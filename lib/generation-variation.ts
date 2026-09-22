import {
  extractExperienceFacts,
  type ExperienceFact,
} from "@/lib/content-evidence";
import type { CoverTitleContext } from "@/lib/cover/cover-rules";
import { stripGeneratedLocationTime } from "@/lib/locations";

export const CAPTION_STRUCTURES = ["A", "B", "C", "D", "E", "F"] as const;
export type CaptionStructureId = (typeof CAPTION_STRUCTURES)[number];

export const CAPTION_LENGTH_BANDS = ["short", "medium", "long", "extended"] as const;
export type CaptionLengthBand = (typeof CAPTION_LENGTH_BANDS)[number];

export const CAPTION_FOCUSES = [
  "food",
  "atmosphere",
  "service",
  "highlight",
  "experience",
  "custom",
  "dish",
  "location",
  "spend",
] as const;
export type CaptionFocusId = (typeof CAPTION_FOCUSES)[number];

export const LENGTH_BAND_RANGE: Record<CaptionLengthBand, { min: number; max: number }> = {
  short: { min: 80, max: 120 },
  medium: { min: 120, max: 180 },
  long: { min: 180, max: 260 },
  extended: { min: 260, max: 330 },
};

export type GenerationVariationPlan = {
  structureId: CaptionStructureId;
  lengthBand: CaptionLengthBand;
  lengthMin: number;
  lengthMax: number;
  focusId: CaptionFocusId;
  coverFocusId: CaptionFocusId;
  titleFocuses: [CaptionFocusId, CaptionFocusId, CaptionFocusId];
};

const STRUCTURE_COPY: Record<CaptionStructureId, string> = {
  A: "Structure A — food-led: opening → dishes/food → restaurant experience → other selected points → light recommend",
  B: "Structure B — visit-led: opening → restaurant trait → environment/service → food → recommend",
  C: "Structure C — visitor-led: opening → tourist-helpful points (Chinese menu / payment / service) → food → overall feel",
  D: "Structure D — dish-led: opening → recommended dish → why they recommend it → other restaurant experience → close",
  E: "Structure E — experience-led: opening → first-impression / this visit feel → restaurant traits → food → other details",
  F: "Structure F — light share: short opening → 2–3 strongest real highlights → brief close. Do not list every tag.",
};

const FOCUS_COPY: Record<CaptionFocusId, string> = {
  food: "food / overall taste",
  atmosphere: "space / atmosphere",
  service: "service / staff",
  highlight: "a selected restaurant highlight",
  experience: "the overall dining feel",
  custom: "the customer's own written note",
  dish: "a selected recommended dish",
  location: "mall / location scene",
  spend: "spend / value only if the customer gave an amount",
};

const FACT_DESCRIPTIONS: Record<string, string[]> = {
  "handsome-owner": ["这顿还有个记忆点，老板本人真的很有印象。", "老板本人很帅，见面就会记住。"],
  "friendly-owner": ["老板本人很亲切，吃饭时感觉很自然。", "老板很好说话，整个人会放松下来。"],
  "good-service": [
    "店员服务很热情，整个用餐过程都让人觉得很舒服。",
    "服务很到位，吃饭的时候不用自己操心太多。",
  ],
  "mall-stop": ["逛完街之后刚好过来吃，行程上刚刚好。", "逛街后来吃这顿，时间上刚刚好。"],
  comfortable: ["店里坐着很舒服，整个人都放松下来了。", "店里氛围比较放松，适合慢慢吃。"],
  "first-visit": ["第一次来，原本只是想试试看。", "第一次来尝试Baan Ying，没有想太多。"],
  "for-two": ["两个人吃下来很满足。", "两个人点，份量刚刚好。"],
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

function availableFocuses(context: CoverTitleContext, facts: ExperienceFact[]): CaptionFocusId[] {
  const focuses = new Set<CaptionFocusId>();
  const enjoy = (context.enjoyMost ?? []).join(" ");
  const note = context.diningNote?.trim() ?? "";
  if (facts.some((fact) => fact.kind === "food") || /正宗|好吃/.test(`${enjoy}${note}`)) focuses.add("food");
  if (facts.some((fact) => fact.kind === "atmosphere") || /面积|环境|温馨|翻新/.test(`${enjoy}${note}`)) {
    focuses.add("atmosphere");
  }
  if (facts.some((fact) => fact.kind === "service") || /服务|中文菜单|支付宝/.test(`${enjoy}${note}`)) {
    focuses.add("service");
  }
  if (enjoy.length > 0) focuses.add("highlight");
  if (note.length > 0) {
    focuses.add("custom");
    focuses.add("experience");
  }
  if ((context.dishes ?? []).some((item) => item && item !== "Others")) focuses.add("dish");
  if (facts.some((fact) => fact.id === "mall-stop" || fact.id === "mall-chain") || /商场|逛/.test(`${enjoy}${note}`)) {
    focuses.add("location");
  }
  if (typeof context.mealAmount === "number" && context.mealAmount > 0) focuses.add("spend");
  if (focuses.size === 0) focuses.add("experience");
  return [...focuses];
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

function detectFocus(text: string, facts: ExperienceFact[]): CaptionFocusId {
  const hay = text;
  if (facts.some((fact) => fact.id === "featured-dish" && fact.markers.some((marker) => hay.includes(marker)))) {
    return "dish";
  }
  if (/服务|中文菜单|支付宝/.test(hay)) return "service";
  if (/面积|很大|温馨|翻新|舒服|环境/.test(hay)) return "atmosphere";
  if (/逛|商场|centralwOrld/.test(hay)) return "location";
  if (/正宗|好吃|味道|菜/.test(hay)) return "food";
  return "experience";
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

export function planGenerationVariation(input: {
  context?: CoverTitleContext;
  variantIndex?: number;
  previousCaption?: string;
  previousCoverTitle?: string;
  previousTitles?: string[];
}): GenerationVariationPlan {
  const context = input.context ?? {};
  const facts = extractExperienceFacts(context);
  const focuses = availableFocuses(context, facts);
  const seed = input.variantIndex ?? 0;
  const previousCaption = input.previousCaption ?? "";
  const previousFocus = previousCaption ? detectFocus(previousCaption, facts) : undefined;
  const previousCoverFocus = input.previousCoverTitle
    ? detectFocus(input.previousCoverTitle, facts)
    : undefined;
  const previousBand = previousCaption ? detectLengthBand(previousCaption) : undefined;
  const previousStructure = previousCaption
    ? CAPTION_STRUCTURES[storyHanCount(previousCaption) % CAPTION_STRUCTURES.length]
    : undefined;

  const focusId = pickRotated(focuses, seed + 3, previousFocus) ?? "experience";
  const coverFocusId =
    pickRotated(
      focuses.filter((item) => item !== focusId),
      seed + 11,
      previousCoverFocus,
    ) ?? focusId;
  const titlePool = [...focuses];
  const titleFocuses: [CaptionFocusId, CaptionFocusId, CaptionFocusId] = [
    pickRotated(titlePool, seed + 1, previousFocus) ?? focusId,
    pickRotated(titlePool, seed + 5, focusId) ?? "highlight",
    pickRotated(titlePool, seed + 9, coverFocusId) ?? "experience",
  ];
  if (titleFocuses[1] === titleFocuses[0] && titlePool.length > 1) {
    titleFocuses[1] = titlePool.find((item) => item !== titleFocuses[0]) ?? titleFocuses[1];
  }
  if (titleFocuses[2] === titleFocuses[0] || titleFocuses[2] === titleFocuses[1]) {
    titleFocuses[2] =
      titlePool.find((item) => item !== titleFocuses[0] && item !== titleFocuses[1]) ?? titleFocuses[2];
  }

  const structureId =
    pickRotated([...CAPTION_STRUCTURES], seed + 7, previousStructure) ??
    CAPTION_STRUCTURES[seed % CAPTION_STRUCTURES.length];
  const bands = allowedLengthBands(evidenceRichness(context));
  const lengthBand = pickRotated(bands, seed + 13, previousBand) ?? bands[0];
  const range = LENGTH_BAND_RANGE[lengthBand];

  return {
    structureId,
    lengthBand,
    lengthMin: range.min,
    lengthMax: range.max,
    focusId,
    coverFocusId,
    titleFocuses,
  };
}

export function formatGenerationVariationRules(plan: GenerationVariationPlan) {
  return `THIS ROUND INDEPENDENT DRAFT — treat Generate / Regenerate as a new post, not an edit of the last one.

Do NOT: swap synonyms, move one sentence, only change emoji, or keep the same paragraph skeleton.
Do: pick a different real focus, a different narrative structure, a different information mix, and a different caption length.

THIS ROUND FOCUS: ${plan.focusId} (${FOCUS_COPY[plan.focusId]}). Open from this point. Do not always open from food.
THIS ROUND TITLE ANGLES: Title 1 = ${plan.titleFocuses[0]}; Title 2 = ${plan.titleFocuses[1]}; Title 3 = ${plan.titleFocuses[2]}. Three different real selling points, not the same sentence with swapped words.
THIS ROUND COVER: mainTitle from ${plan.coverFocusId}; subTitle from a DIFFERENT real point. Do not clip a caption sentence. Do not reuse the previous cover formula.

THIS ROUND STRUCTURE: ${STRUCTURE_COPY[plan.structureId]}
Do not reuse the previous opening, fact order, or paragraph skeleton.

THIS ROUND CAPTION LENGTH: ${plan.lengthBand} ≈ ${plan.lengthMin}–${plan.lengthMax} Chinese characters (story body only, no 📍/⏰).
Count must be obviously different from the previous caption. Never 145 → 147 → 146.
If the customer gave little evidence, stay in a shorter allowed band — never invent to hit Long / Extended.
If they selected many points, you MAY write longer and cover more, but natural Chinese > stuffing every tag.

MULTI-SELECT: If several enjoy-most / dish / reason items exist, the caption must naturally cover MORE THAN ONE. Describe each chosen point (what it felt like), do not only name it.
BAD: 有中文菜单，餐厅面积很大，店员服务很好，食物很好吃，还可以使用支付宝。
BAD: 服务很好。 / 餐厅很大。
GOOD: 店里有中文菜单，点菜不会有太大压力。餐厅空间也比想象中大，店员服务很热情，整体吃下来很舒服。
Naturalness > covering every option. Drop a minor point if it cannot join the story cleanly.

CHINESE NATURALNESS: Write complete sentences. Do not glue keywords.
BAD: 就是食材新鲜度感觉提升空间 / 服务热情周到感觉很好 / 中文菜单游客方便很多体验
GOOD: 感觉食材的新鲜度还有一点提升空间。 / 店员服务很热情，整个用餐过程都让人觉得很舒服。
Keep the customer's sentiment. 食物味道正宗美味 must stay positive. Do not add 提升空间 unless they wrote it.
Do not spray 就是 / 感觉 / 其实 / 整体 / 体验 to fake spoken tone.
Avoid AI stock unless they wrote it: 整体而言 / 值得一提的是 / 不得不说 / 给人一种 / 令人印象深刻 / 可以说是 / 作为一个 / 无论是…还是… / 如果你也… / 强烈推荐大家…
Prefer lived phrasing only when it fits the evidence: 这次比较喜欢的是 / 我自己最喜欢 / 没想到 / 对游客来说 / 这一点还蛮方便的 / 吃下来觉得 / 比较让我满意的是 / 如果第一次来 / 这次最想推荐的是.

Variation must NOT invent dishes, prices, promos, service, atmosphere, feelings, places, ingredients, or restaurant traits that are not in the customer input or confirmed restaurant data.`;
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
  if (fact.id === "featured-dish" && fact.markers[0]) {
    variants.unshift(
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
  const byId = (ids: string[]) =>
    ids.map((id) => facts.find((fact) => fact.id === id)).filter((fact): fact is ExperienceFact => Boolean(fact));
  const rest = facts.filter((fact) => fact.id !== "first-visit");
  const food = facts.filter((fact) => fact.kind === "food");
  const service = facts.filter((fact) => fact.kind === "service" || fact.id === "chinese-menu" || fact.id === "alipay");
  const room = facts.filter((fact) => fact.kind === "atmosphere");
  const scene = facts.filter((fact) => fact.kind === "scene");
  switch (plan.structureId) {
    case "A":
      return uniqueFacts([...food, ...room, ...service, ...rest]);
    case "B":
      return uniqueFacts([...scene, ...room, ...service, ...food, ...rest]);
    case "C":
      return uniqueFacts([...byId(["chinese-menu", "alipay"]), ...service, ...food, ...room, ...rest]);
    case "D":
      return uniqueFacts([...byId(["featured-dish"]), ...food, ...room, ...service, ...rest]);
    case "E":
      return uniqueFacts([...byId(["first-visit"]), ...room, ...service, ...food, ...rest]);
    case "F":
      return uniqueFacts([...food, ...service, ...room, ...rest]).slice(0, 3);
    default:
      return uniqueFacts(facts);
  }
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
  const dish = facts.find((fact) => fact.id === "featured-dish")?.markers[0] ?? "";
  const tourist = context.customerType === "Tourist";
  const options: string[] = [];
  if (plan.structureId === "A" && facts.some((fact) => fact.kind === "food")) {
    options.push("这次比较想说的还是吃的。");
  }
  if (plan.structureId === "B") {
    options.push("先说这家店比较让我记得住的地方。");
  }
  if (plan.structureId === "C" && tourist) {
    options.push("对游客来说，这顿吃得比较省心。");
  }
  if (plan.structureId === "C" && firstVisit) {
    options.push("第一次来吃其实还挺方便的。");
  }
  if (plan.structureId === "D" && dish) {
    options.push(`这次最想推荐的是${dish}。`);
  }
  if (plan.structureId === "E" && firstVisit) {
    options.push("第一次来，原本只是想试试看。");
  }
  if (plan.structureId === "F") {
    options.push("这顿有几个点还蛮舒服的。");
  }
  if (plan.focusId === "service") options.push("这顿比较让我满意的是服务。");
  if (plan.focusId === "atmosphere" && facts.some((fact) => fact.id === "spacious" || fact.id === "comfortable")) {
    options.push("先说店里的空间。");
  }
  if (options.length === 0) options.push("这顿吃下来，有几个点印象比较深。");
  return options[Math.abs(seed) % options.length] ?? options[0];
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
    const line = descriptionFor(fact, context, seed + index);
    if (!sentences.some((sentence) => sentence.includes(line.slice(0, 6)))) sentences.push(line);
  }
  if (
    plan.structureId !== "F" &&
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
  const facts = extractExperienceFacts(context);
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
  const covered = facts.filter((fact) => splitSentences(caption).some((sentence) => factDescribed(sentence, fact)));
  if (facts.length >= 3 && covered.length < Math.min(2, facts.length)) reasons.push("thin-coverage");
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
  variantIndex?: number;
}) {
  const context = input.context ?? {};
  const facts = extractExperienceFacts(context);
  const seed = input.variantIndex ?? 0;
  let titles = rotateTitles(input.titles, facts, input.plan);
  let cover = rotateCover(input.coverTitle, input.coverSubtitle, input.previousCoverTitle ?? "", facts);
  let caption = stripGeneratedLocationTime(input.caption);
  caption = expandMentionOnly(caption, context, facts, input.plan, seed);
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
    (verdict.reasons.includes("caption-similar") || verdict.reasons.includes("thin-coverage"))
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
    });
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
    titles,
    caption,
    coverTitle: cover.coverTitle,
    coverSubtitle: cover.coverSubtitle,
    needsRetry: false,
    reasons: verdict.reasons,
  };
}
