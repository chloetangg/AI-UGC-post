import { branchKey, OFFICIAL_LOCATIONS, type BaanYingLocationId } from "@/lib/locations";
import { formatCoverAbsoluteRules } from "./cover-absolute";
import {
  collectFullDishNames,
  coverDishShortName,
  formatCoverDishNameRules,
  mentionsCoverDishName,
} from "./dish-names";
import { sanitizeCoverLine, toCoverGraphemes } from "./cover-title-text";
import { formatCoverNaturalRules } from "./cover-natural";

export const COVER_LOCATION_KEYWORDS = [
  "centralwOrld",
  "Terminal 21",
  "Siam Center",
  "One Bangkok",
] as const;

export const COVER_GENERIC_KEYWORDS = ["曼谷", "泰餐", "美食", "必吃"] as const;

/** Cover titles must use at least one of these in the main title. */
export const COVER_POOL_KEYWORDS = ["曼谷", "centralwOrld", "泰餐", "美食", "必吃"] as const;

export const COVER_MANDATORY_KEYWORDS = [
  ...COVER_GENERIC_KEYWORDS,
  ...COVER_LOCATION_KEYWORDS,
] as const;

/** Compact CJK-equivalent units for approved Latin proper nouns. */
export const COVER_LOCATION_UNITS: Record<(typeof COVER_LOCATION_KEYWORDS)[number], number> = {
  centralwOrld: 1,
  "Terminal 21": 2,
  "Siam Center": 2,
  "One Bangkok": 2,
};

const LOCATION_ALIASES: Array<{ canonical: (typeof COVER_LOCATION_KEYWORDS)[number]; pattern: RegExp }> = [
  { canonical: "centralwOrld", pattern: /central\s*world/gi },
  { canonical: "Terminal 21", pattern: /terminal\s*21/gi },
  { canonical: "Siam Center", pattern: /siam\s*center/gi },
  { canonical: "One Bangkok", pattern: /one\s*bangkok/gi },
];

const KSP_MARKERS = [
  "招牌",
  "口味",
  "食材",
  "菜品",
  "料理",
  "隐藏",
  "体验",
  "环境",
  "位置",
  "性价比",
  "菜单",
  "家常",
  "泰式",
  "探店",
  "好拍",
  "出片",
  "好吃",
  "必吃",
  "冬阴功",
  "咖喱",
  "芒果",
  "糯米",
  "蒸鱼",
  "炒虾",
  "酸甜",
  "蒜蓉",
  "蟹",
  "美食",
  "泰餐",
  "推荐",
  "宝藏",
  "地标",
  "私藏",
  "温馨",
  "好拍",
] as const;

export type CoverTitleContext = {
  branch?: string;
  dishes?: string[];
  sourceTexts?: string[];
  postTitles?: string[];
  previousCoverTitle?: string;
  previousCoverHookType?: "personal-experience" | "food" | "scene" | "atmosphere" | "discovery";
  previousPrimaryExperience?: string;
  previousTitleAngle?: string;
  variantIndex?: number;
  kspId?: string;
  contentAngleId?: string;
  diningNote?: string;
  mealAmount?: number | null;
  enjoyMost?: string[];
  recommendTo?: string[];
  visitFrequency?: string;
  customerType?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCoverLocations(text: string) {
  let next = text;
  for (const alias of LOCATION_ALIASES) {
    next = next.replace(new RegExp(alias.pattern.source, "gi"), alias.canonical);
  }
  return next;
}

export function selectedCoverLocation(branch?: string) {
  const key = branch ? branchKey(branch) : "";
  if (!key) return "";
  return OFFICIAL_LOCATIONS[key as BaanYingLocationId].englishName;
}

export function findCoverLocationKeywords(text: string) {
  const hay = normalizeCoverLocations(sanitizeCoverLine(text));
  return COVER_LOCATION_KEYWORDS.filter((keyword) =>
    hay.toLowerCase().includes(keyword.toLowerCase()),
  );
}

export function findCoverKeywords(text: string) {
  const hay = normalizeCoverLocations(sanitizeCoverLine(text));
  const found: string[] = [];
  for (const keyword of [...COVER_POOL_KEYWORDS].sort((a, b) => b.length - a.length)) {
    if (keyword === "centralwOrld") {
      if (hay.toLowerCase().includes("centralworld")) found.push(keyword);
      continue;
    }
    if (hay.includes(keyword)) found.push(keyword);
  }
  return found;
}

export function uniqueCoverPoolKeywords(mainTitle: string, subTitle = "") {
  return [...new Set(findCoverKeywords(`${mainTitle}${subTitle}`))];
}

/** Cover main title must contain at least one pool keyword. */
export function hasCoverTitleKeyword(mainTitle: string) {
  return uniqueCoverPoolKeywords(mainTitle).length >= 1;
}

export function hasExactCoverKeywordPair(mainTitle: string, subTitle = "") {
  return uniqueCoverPoolKeywords(mainTitle, subTitle).length === 2;
}

export function coverKeywordPairKey(mainTitle: string, subTitle = "") {
  return uniqueCoverPoolKeywords(mainTitle, subTitle).slice().sort().join("+");
}

const COVER_PROPER_NOUN_UNITS: Array<{ pattern: RegExp; units: number }> = [
  { pattern: /baan\s*ying/gi, units: 2 },
];

/**
 * Chinese-character-equivalent units for cover length rules.
 * Han = 1. centralwOrld = 1. Terminal 21 / Siam Center / One Bangkok = 2.
 * Baan Ying = 2. Other Latin/digits = 0.5, rounded up.
 */
export function countCoverUnits(text: string) {
  let remaining = normalizeCoverLocations(sanitizeCoverLine(text));
  let units = 0;
  for (const keyword of [...COVER_LOCATION_KEYWORDS].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(escapeRegExp(keyword), "gi");
    remaining = remaining.replace(pattern, () => {
      units += COVER_LOCATION_UNITS[keyword];
      return "\0";
    });
  }
  for (const noun of COVER_PROPER_NOUN_UNITS) {
    remaining = remaining.replace(noun.pattern, () => {
      units += noun.units;
      return "\0";
    });
  }
  remaining = remaining.replace(/\0+/g, "").replace(/\s+/g, "");
  let halfWidth = 0;
  for (const part of toCoverGraphemes(remaining)) {
    if (/\p{Script=Han}/u.test(part)) {
      units += 1;
      continue;
    }
    if (/[A-Za-z0-9]/u.test(part)) {
      halfWidth += 1;
    }
  }
  return units + Math.ceil(halfWidth / 2);
}

export function hasMandatoryCoverKeyword(mainTitle: string, subTitle = "") {
  return uniqueCoverPoolKeywords(mainTitle, subTitle).length > 0;
}

export function usesUnselectedCoverLocation(text: string, branch?: string) {
  const found = findCoverLocationKeywords(text);
  if (found.length === 0) return false;
  if (!branch?.trim()) return false;
  const selected = selectedCoverLocation(branch);
  if (!selected) return true;
  return found.some((item) => item.toLowerCase() !== selected.toLowerCase());
}

export function hasCoverKsp(mainTitle: string, subTitle = "") {
  const combined = normalizeCoverLocations(sanitizeCoverLine(`${mainTitle}${subTitle}`));
  if (!combined) return false;
  if (KSP_MARKERS.some((marker) => combined.includes(marker))) return true;
  let leftover = combined;
  for (const keyword of COVER_POOL_KEYWORDS) {
    leftover = leftover.split(keyword).join("");
  }
  leftover = leftover.replace(/\s+/g, "");
  return (leftover.match(/\p{Script=Han}/gu)?.length ?? 0) >= 2;
}

export function isCoverKeywordStuffing(mainTitle: string, _subTitle = "") {
  const unique = uniqueCoverPoolKeywords(mainTitle);
  if (unique.length >= 3) return true;
  return unique.some((keyword) => {
    const pattern = new RegExp(escapeRegExp(keyword), "gi");
    const matches = mainTitle.match(pattern) ?? [];
    return matches.length >= 2;
  });
}

const LOCATION_LEANING_KSPS = new Set(["KSP-06", "KSP-07"]);
const LOCATION_LEANING_ANGLES = new Set(["CA-04", "CA-09"]);
const FOOD_LEANING_ANGLES = new Set(["CA-02", "CA-03", "CA-06"]);

export function coverUsesSelectedLocation(text: string, branch?: string) {
  const selected = selectedCoverLocation(branch);
  if (!selected) return false;
  return findCoverLocationKeywords(text).some(
    (item) => item.toLowerCase() === selected.toLowerCase(),
  );
}

/** Location-led stories may use centralwOrld as one of the two cover keywords. Never mandatory. */
export function shouldUseCoverLocation(context: CoverTitleContext = {}) {
  if (!selectedCoverLocation(context.branch)) return false;
  if (FOOD_LEANING_ANGLES.has(context.contentAngleId ?? "") && (context.dishes?.length ?? 0) > 0) {
    return false;
  }
  if (LOCATION_LEANING_KSPS.has(context.kspId ?? "")) return true;
  if (LOCATION_LEANING_ANGLES.has(context.contentAngleId ?? "")) return true;
  return false;
}

export function preferredCoverKeyword(context: CoverTitleContext | string = {}) {
  if (typeof context === "string") {
    return "曼谷";
  }
  if (shouldUseCoverLocation(context)) return selectedCoverLocation(context.branch) || "曼谷";
  return "曼谷";
}

const TEMPLATE_COVER_SPEAK =
  /让人(惊艳|上头|念念不忘|欲罢不能|直呼好吃)|超好吃|太绝了|真的很惊艳|第一次来就被圈粉|第一次来就爱上|第一次来就彻底爱上|第一次美食冒险|美食冒险|惊艳到不行|狠狠圈粉|彻底爱上/;

const COVER_SLANG =
  /绝绝子|yyds|YYDS|狠狠爱了|直接封神|太太太好吃|真的会谢|谁懂啊|^救命$|救命啊|不允许有人没吃过|吃到撑/;

const COVER_BRAND_PROMO =
  /精选泰式|品尝正宗|满足味蕾|带来温暖舒适|独特风味|丰富菜品搭配|正宗泰式美食/;

export function looksLikeCoverTemplateSpeak(text: string) {
  const hay = sanitizeCoverLine(text);
  return TEMPLATE_COVER_SPEAK.test(hay) || COVER_SLANG.test(hay) || COVER_BRAND_PROMO.test(hay);
}

/** Subtitle may carry only ONE evidence. Dish + price + first-visit concatenations fail. */
export function packsMultipleCoverEvidence(text: string, context: CoverTitleContext = {}) {
  const hay = sanitizeCoverLine(text);
  if (!hay) return false;
  const dishes = collectFullDishNames({
    dishes: context.dishes,
    sourceTexts: [...(context.sourceTexts ?? []), context.diningNote ?? "", hay],
  });
  const hasDish =
    mentionsCoverDishName(hay, dishes) ||
    /河虾冬阴功汤|冬阴功|咖喱蟹肉|炒空心菜|菠萝炒饭|芒果糯米饭|滑蛋饭|蒜炒虾仁|青柠蒸鲈鱼|酸甜酱炒河虾|青咖喱牛肉/.test(hay);
  const hasPrice = /\d+\s*(泰铢|THB)/i.test(hay);
  const hasFirst = /第一次/.test(hay);
  const hasMall = findCoverLocationKeywords(hay).length > 0;
  const hits = [hasDish, hasPrice, hasFirst, hasMall].filter(Boolean).length;
  if (hits >= 2) return true;
  return /[，、].+[，、]/.test(hay);
}

function hasCustomerEvidence(context: CoverTitleContext) {
  return Boolean(
    context.diningNote?.trim() ||
      (context.dishes?.length ?? 0) > 0 ||
      (context.enjoyMost?.length ?? 0) > 0 ||
      context.visitFrequency ||
      (typeof context.mealAmount === "number" && context.mealAmount > 0),
  );
}

export function inventsUnsupportedCoverClaim(text: string, context: CoverTitleContext) {
  if (!hasCustomerEvidence(context)) return false;
  const evidence = [
    context.diningNote ?? "",
    ...(context.dishes ?? []),
    ...(context.enjoyMost ?? []),
    ...(context.recommendTo ?? []),
    ...(context.sourceTexts ?? []),
    context.visitFrequency ?? "",
    context.customerType ?? "",
  ].join(" ");
  if (/打抛|DIY/i.test(text) && !/打抛|DIY|pad\s*kra|pad\s*ga/i.test(evidence)) return true;
  if (/家的味道|像家里|家里做的|家常感/.test(text) && !/家|家常|家里|home/i.test(evidence)) return true;
  if (/逛完街|逛街后/.test(text) && !/逛街|逛完|方便|mall|central/i.test(evidence) && !shouldUseCoverLocation(context)) {
    return true;
  }
  if (/帅老板|老板好帅|老板很帅|被老板帅/.test(text) && !/帅/.test(evidence)) return true;
  if (/老板很亲切|老板本人很亲切/.test(text) && !/老板/.test(evidence)) return true;
  if (/被服务圈粉|服务真的很好|服务也很舒服/.test(text) && !/服务|店员服务/.test(evidence)) return true;
  if (
    /两个人|和朋友|一家[三四五]口|一家人|带家人|一个人来|我们几个/.test(text) &&
    !/两个人|两人来|两人吃|和朋友|家人一起|带家人|一家[三四五]口|一个人来|几个人/.test(
      `${context.diningNote ?? ""} ${(context.enjoyMost ?? []).join(" ")}`,
    )
  ) {
    return true;
  }
  return false;
}

function firstCoverDishName(context: CoverTitleContext) {
  const names = collectFullDishNames({
    dishes: context.dishes,
    sourceTexts: [...(context.sourceTexts ?? []), context.diningNote ?? ""],
  });
  return names[0] ?? "";
}

const ENJOY_SUBTITLES: Array<{ match: RegExp; subtitle: string }> = [
  { match: /atmosphere|环境/i, subtitle: "坐下来刚好能慢慢聊" },
  { match: /service|服务/i, subtitle: "用餐气氛比较放松" },
  { match: /presentation|摆盘/i, subtitle: "摆盘好看很想拍照" },
  { match: /variety|菜品多|variety of dishes/i, subtitle: "一次能点到很多菜" },
  { match: /flavor|口味/i, subtitle: "这口味道有点像家常" },
  { match: /food|the food/i, subtitle: "这几道菜还想再点" },
];

function fitsSubtitleUnits(text: string) {
  const units = countCoverUnits(text);
  return units >= 6 && units <= 10;
}

export function subtitleFromCoverContext(context: CoverTitleContext = {}) {
  const note = context.diningNote?.trim() ?? "";
  const dish = firstCoverDishName(context);
  const short = dish ? coverDishShortName(dish) : "";

  if (/老板/.test(note) && /帅|好看|英俊/.test(note)) {
    if (fitsSubtitleUnits("老板本人很有记忆点")) return "老板本人很有记忆点";
    if (fitsSubtitleUnits("来吃饭被老板帅到了")) return "来吃饭被老板帅到了";
  }
  if (/老板/.test(note) && /亲切|友善|热情/.test(note)) {
    if (fitsSubtitleUnits("老板本人很亲切")) return "老板本人很亲切";
  }
  if (
    /(服务|服务员).{0,8}(很好|真好|周到|舒服|礼貌|圈粉)/.test(note) &&
    !/没有.{0,8}服务|服务不好|没有特别的服务/.test(note)
  ) {
    if (fitsSubtitleUnits("服务也很舒服")) return "服务也很舒服";
    if (fitsSubtitleUnits("用餐服务很到位")) return "用餐服务很到位";
  }
  if (/逛完|逛街后|逛街后来|逛完街|逛完商场/.test(note)) {
    if (fitsSubtitleUnits("逛完街来吃刚刚好")) return "逛完街来吃刚刚好";
  }
  if (/(店里|环境|氛围|坐着|吃饭).{0,8}(舒服|温馨|放松)|很适合聊天/.test(note)) {
    if (fitsSubtitleUnits("店里坐着很舒服")) return "店里坐着很舒服";
    if (fitsSubtitleUnits("很适合慢慢吃")) return "很适合慢慢吃";
  }
  if (/DIY|自己动手|打抛/.test(note)) {
    if (fitsSubtitleUnits("原来打抛饭也可以DIY")) return "原来打抛饭也可以DIY";
    if (fitsSubtitleUnits("自己动手拌打抛饭")) return "自己动手拌打抛饭";
  }
  if (short && /家里|家的味道|家常/.test(note)) {
    const likeHome = `${short}像家的味道`;
    if (fitsSubtitleUnits(likeHome)) return likeHome;
    if (fitsSubtitleUnits(`这口${short}像家的味道`)) return `这口${short}像家的味道`;
  }
  if (/逛街|逛完|方便/.test(note)) {
    if (fitsSubtitleUnits("逛完街来吃刚刚好")) return "逛完街来吃刚刚好";
  }
  if (short && (/很好吃|合口味|很香/.test(note) || !note)) {
    const named = `没想到超爱${short}`;
    if (fitsSubtitleUnits(named)) return named;
    const special = `这口${short}有点特别`;
    if (fitsSubtitleUnits(special)) return special;
    if (fitsSubtitleUnits("没想到超爱这道")) return "没想到超爱这道";
  }
  const amount = context.mealAmount;
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    const party = /两个人|两人来|两人吃|两人用餐/.test(context.diningNote ?? "");
    const withAmount = party
      ? `两人${Math.round(amount)}泰铢很满足`
      : `${Math.round(amount)}泰铢这顿很满足`;
    if (fitsSubtitleUnits(withAmount)) return withAmount;
    if (party && fitsSubtitleUnits("两个人吃下来很满足")) return "两个人吃下来很满足";
    if (fitsSubtitleUnits("这顿吃下来很满足")) return "这顿吃下来很满足";
  }
  if (/1st time|first/i.test(context.visitFrequency ?? "")) {
    return "第一次来尝试Baan Ying";
  }
  for (const tag of context.enjoyMost ?? []) {
    const hit = ENJOY_SUBTITLES.find((item) => item.match.test(tag));
    if (hit) return hit.subtitle;
  }
  if (shouldUseCoverLocation(context)) return "逛完街来吃刚刚好";
  return "这顿吃下来很满足";
}

export function coverFallbackPairs(context: CoverTitleContext = {}) {
  const location = selectedCoverLocation(context.branch);
  const subtitle = subtitleFromCoverContext(context);
  const pairs = [
    { title: "曼谷泰餐推荐", subtitle },
    { title: "曼谷必吃泰菜", subtitle },
    { title: "曼谷吃什么？", subtitle },
    { title: "曼谷美食探店", subtitle },
    { title: "曼谷吃饭很舒服", subtitle },
    { title: "必吃泰式料理", subtitle },
  ];
  if (location === "centralwOrld" && /逛|商场|方便/.test(context.diningNote ?? "")) {
    pairs.unshift(
      { title: "centralwOrld泰餐", subtitle },
      { title: "centralwOrld必吃美食", subtitle },
    );
  }
  return pairs;
}

export function formatCoverTitleRules(context: CoverTitleContext = {}) {
  const location = selectedCoverLocation(context.branch);
  const previousMain = (context.previousCoverTitle ?? "").split("/")[0]?.trim() || "none";
  const note = context.diningNote?.trim() || "none";
  const amount =
    typeof context.mealAmount === "number" && Number.isFinite(context.mealAmount) && context.mealAmount > 0
      ? `${Math.round(context.mealAmount)} THB`
      : "not provided";
  const enjoy = (context.enjoyMost ?? []).filter(Boolean).join(", ") || "none";
  const dishes = (context.dishes ?? []).filter(Boolean).join(", ") || "none";
  const locationHint = location
    ? `Dining location (system-provided): ${location}. Cover may use exact centralwOrld when the mall is the hook. Across Title 1–3 + Cover Title + Cover Subtitle, exact "centralwOrld" must appear once — not necessarily on the cover. Never invent Terminal 21 / Siam Center / One Bangkok.`
    : "No dining mall keyword is available. Do NOT invent centralwOrld, Terminal 21, Siam Center, or One Bangkok.";

  return `COVER OVERLAY — JSON "mainTitle" (= coverTitle) + "subTitle" (= coverSubtitle). Independent from titles[]. Never shorten titles[] into the cover. Generate both in THIS same JSON. No extra API call.

CORE PRIORITY: natural Chinese > THIS customer's lived evidence > one clear selling point > click/save value > length.
Search keyword is an SEO layer, not the topic. Never let 曼谷/美食/泰餐/发现 decide what the cover is about.
Never satisfy “must have dish + keyword + evidence + length” by gluing words into a strange sentence.
The cover must feel rewritten from THIS visit, not like AI concatenated keywords.

MAIN TITLE (mainTitle)
Write a real Xiaohongshu cover headline: short, clickable, natural, one clear topic from the customer's experience. Not a keyword list. Not SEO stuffing.
Must include AT LEAST ONE pool keyword: 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃
The keyword must be woven into the experience hook. TWO are allowed only if it still reads as a headline. MAX 2 pool keywords. Never 3+.
Priority: USER EXPERIENCE > specific food/scene > search keyword.
GOOD: 曼谷泰餐遇到帅老板 / 老板很帅的曼谷泰餐 / 曼谷必吃泰菜 / 曼谷吃什么？ / 曼谷美食探店 / 曼谷泰餐推荐
BAD: 曼谷超爱次来吃 / 曼谷很值得来吃 / 曼谷推荐来吃 / 曼谷好吃必吃 / 曼谷美食来打卡 / 曼谷超推荐吃 / 曼谷爱吃这家 / 曼谷泰餐美食必吃
Never glue 曼谷 onto a broken stub to satisfy a keyword. If a phrase cannot sit naturally, switch phrase.
Never use 曼谷美食发现 as a default when the dining note has a person, service, scene, atmosphere, or food reaction.
Length: 4–10 units MAX. Not a target. Han=1. centralwOrld=1. Terminal 21 / Siam Center / One Bangkok=2. Baan Ying=2. Other Latin/digits=0.5 rounded up. Prefer a short complete line over padding to 10.
Do not copy titles[]. Do not shorten a post title. Do not copy the previous cover formula (changing only 推荐/泰菜 is NOT a new title).
Mall names only when location is the hook (mall KSP / shopping route). Food-led posts must not force a mall name. Never name a place the customer did not visit.
Previous coverTitle (do not copy): ${previousMain}

SUBTITLE (subTitle)
Do not only describe the dish. Find the hook: what detail from THIS visit makes someone tap in.
Need: real evidence + Xiaohongshu voice + light emotion + modest curiosity. Never invent a feeling, fact, or review the customer did not give.
Accuracy > clickiness. Natural ≠ bland. Clicky ≠ exaggerated. Spoken ≠ slang. Emotion ≠ fake praise. Hook ≠ made-up facts. Short ≠ keyword dump.

Voice: a friend sharing this meal on Xiaohongshu, not restaurant advertising.
FORBIDDEN brand speak: 精选泰式家常料理 / 品尝正宗泰式美食 / 丰富菜品搭配，满足味蕾需求 / 招牌泰式料理 / 家常泰式料理
FORBIDDEN slang unless the customer asked for it: 绝绝子 / yyds / 狠狠爱了 / 直接封神 / 太太太好吃了 / 真的会谢 / 谁懂啊 / 救命 / 不允许有人没吃过
Spoken texture is allowed as a method, not a template: 没想到 / 原来 / 这口 / 这一道 / 居然 / 真的有点 / 吃出了 / 有点像 / 刚好 / 意外地 / 超爱的反而是 / 逛完刚好来吃. Do not paste these if the evidence does not support them.

Pick ONE core evidence only. Then choose the highest style the evidence actually supports:
1 curiosity (没想到超爱的是这道 / 这口咖喱蟹肉有点特别)
2 contrast/surprise ONLY if the customer said something unexpected
3 scene (逛完街来吃刚刚好 / 自己动手拌打抛饭)
4 emotion already in the evidence (这顿吃下来很满足)
5 information last (这顿吃下来很满足 / 咖喱蟹肉很有家常味). Mention 两人 only if the customer wrote they dined as two.
Never glue dish + price + first-visit. Never 咖喱蟹肉味道很像泰式家常菜而且两个人吃600泰铢.
Do not default to 菜名+很好吃 / 菜名+很有家常味 when a supported hook exists.
Do not inflate: 不错 ≠ 惊艳到不行; 价格还可以 ≠ 吃到撑; 第一次来 ≠ 狠狠圈粉 / 彻底爱上; 喜欢 ≠ 直接封神.

GOOD: 这口咖喱蟹肉像家的味道 / 没想到超爱的是这道 / 原来打抛饭也可以DIY / 逛完街来吃刚刚好 / 这顿吃下来很满足 / 老板本人很有记忆点 / 服务也很舒服
BAD: 咖喱蟹肉很有家常味 (too flat if a hook exists) / 咖喱蟹肉很好吃 / 第一次来咖喱蟹肉很好吃 / 第一次来就被狠狠圈粉 / 精选泰式家常料理 / 老板很帅服务很好 (two facts glued)
Length: 6–10 units, never empty, never a broken sentence. Do not copy the dining note verbatim. Do not repeat mainTitle.

Customer evidence for subtitle (INTERNAL — pick ONE, then rewrite):
- Dining note: ${note}
- Meal spend: ${amount}
- Enjoy-most tags: ${enjoy}
- Selected dishes: ${dishes}
- Visit: ${context.visitFrequency || "none"} / ${context.customerType || "none"}
${locationHint}

If first-visit is the ONLY chosen evidence: 第一次来尝试Baan Ying. Never 第一次美食冒险 / 第一次来就被圈粉 / 第一次来就爱上. If they also said a favorite dish, prefer one hook such as 没想到超爱这道 — do not name the dish AND 第一次来 in the same subtitle.

${formatCoverDishNameRules(context.dishes)}

NEGATIVES: never put 贵 / 难吃 / 踩雷 / 不推荐 / 失望 / 服务不好 / 态度不好 / 不会回购 on the cover. Neutralize or pick another evidence. Never invert into fake praise.

FORBIDDEN except cover keyword 必吃: 第一 (except 第一次/第一道) / 唯一 / 顶级 / 最 / 最爱 / 最强 / 最好吃 / 封神 / 全网第一 / 曼谷第一 / 泰国第一 / 全曼谷 / 全泰国 / 冠军 / 天花板 / 无敌 / Top 1 / No.1 / 必须吃 / 必吃第一名 / 泰国人爱吃 / 本地人爱吃 / 明星爱吃
最爱 must become 超爱. Do not keep 最 because it is “personal”.

${formatCoverAbsoluteRules()}

${formatCoverNaturalRules()}

No hashtag, address, hours, emoji, Location & Time. Never invent a dish.

QUALITY CHECK before return — if any item fails, rewrite from the same single evidence, do not output:
1. Natural spoken Chinese? 2. Grammar OK? 3. No typo / missing / repeated character? 4. No keyword glue? 5. Tied to this customer's input? 6. Sounds like a Xiaohongshu cover? 7. ≤10 units and not padded? 8. If 曼谷 is used, is it natural?
Ask: would a real Xiaohongshu user write this cover line? Would it spark a little curiosity while staying true?
MainTitle: 4–10 units MAX; ≥1 and ≤2 pool keywords; real headline not stuffing; not a shortened titles[] item; not previous cover formula; mall name only if true and relevant; no banned claims; no 最/第一/排名/全范围绝对化 (第一次/最近 OK); no hashtag/address/hours/emoji.
SubTitle: 6–10 units; one complete natural sentence; one core reason from THIS visit; Xiaohongshu hook without new facts; approved dish shorts only; no concatenated evidence; no verbatim note; no mainTitle repeat; no fake praise, slang, or 让人惊艳 templates; no raw negatives; no 最爱 or other 最-ranking; no hashtag/address/hours/emoji.

FALLBACK if mainTitle or subTitle fails: rebuild from diningExperienceNote first (person → service → scene → atmosphere → food), then selected dish, meal spend, first visit, enjoy-most, location convenience. Weave ONE keyword phrase only if it stays natural. Never concatenate 咖喱蟹肉600泰铢第一次来. Never fall back to 曼谷超爱次来吃 / 曼谷美食发现. A complete short line such as 曼谷泰餐推荐 is allowed only when no stronger customer hook exists.`;
}
