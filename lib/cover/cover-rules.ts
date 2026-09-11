import { branchKey, OFFICIAL_LOCATIONS, type BaanYingLocationId } from "@/lib/locations";
import { sanitizeCoverLine, toCoverGraphemes } from "./cover-title-text";

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

/** Latin mall names count as 1 Chinese-character-equivalent unit each. */
export const COVER_LOCATION_UNITS: Record<(typeof COVER_LOCATION_KEYWORDS)[number], number> = {
  centralwOrld: 1,
  "Terminal 21": 1,
  "Siam Center": 1,
  "One Bangkok": 1,
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

const DISH_SUBTITLES: Array<{ match: RegExp; subtitle: string }> = [
  { match: /yellow curry|咖喱蟹|黄咖喱/i, subtitle: "招牌黄咖喱蟹" },
  { match: /tom yum|冬阴功/i, subtitle: "必吃招牌冬阴功" },
  { match: /sweet\s*&\s*sour|酸甜.*鱼|蒸鱼/i, subtitle: "招牌酸甜蒸鱼" },
  { match: /garlic|蒜蓉|炒虾/i, subtitle: "必点蒜蓉炒虾" },
  { match: /mango|芒果糯米/i, subtitle: "必点芒果糯米饭" },
];

export type CoverTitleContext = {
  branch?: string;
  dishes?: string[];
  postTitles?: string[];
  previousCoverTitle?: string;
  variantIndex?: number;
  kspId?: string;
  contentAngleId?: string;
  diningNote?: string;
  mealAmount?: number | null;
  enjoyMost?: string[];
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

/**
 * Chinese-character-equivalent units for cover length rules.
 * Han = 1. Approved Latin mall names such as centralwOrld = 1. Other Latin/digits = 0.5, rounded up.
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
  if (unique.length >= 4) return true;
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

function dishSubtitle(dishes: string[] = []) {
  for (const dish of dishes) {
    const hit = DISH_SUBTITLES.find((item) => item.match.test(dish));
    if (hit) return hit.subtitle;
  }
  return "";
}

const ENJOY_SUBTITLES: Array<{ match: RegExp; subtitle: string }> = [
  { match: /atmosphere|环境/i, subtitle: "环境舒服适合慢慢聊" },
  { match: /service|服务/i, subtitle: "用餐气氛让人放松" },
  { match: /presentation|摆盘/i, subtitle: "摆盘好看很想拍照" },
  { match: /variety|菜品多|variety of dishes/i, subtitle: "一次能点到很多菜" },
  { match: /flavor|口味/i, subtitle: "味道很像泰式家常菜" },
  { match: /food|the food/i, subtitle: "这几道菜让人想再点" },
];

export function subtitleFromCoverContext(context: CoverTitleContext = {}) {
  const dish = dishSubtitle(context.dishes);
  if (dish) return dish;
  const amount = context.mealAmount;
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    return `这餐${Math.round(amount)}泰铢很满足`;
  }
  if (/1st time|first/i.test(context.visitFrequency ?? "")) {
    return "第一次来尝试Baan Ying";
  }
  for (const tag of context.enjoyMost ?? []) {
    const hit = ENJOY_SUBTITLES.find((item) => item.match.test(tag));
    if (hit) return hit.subtitle;
  }
  if (shouldUseCoverLocation(context)) return "逛街后也能坐下慢慢吃";
  return "这顿泰餐让人想收藏";
}

export function coverFallbackPairs(context: CoverTitleContext = {}) {
  const location = selectedCoverLocation(context.branch);
  const subtitle = subtitleFromCoverContext(context);
  const pairs = [
    { title: "曼谷隐藏泰餐", subtitle },
    { title: "曼谷泰餐推荐", subtitle },
    { title: "必吃泰式料理", subtitle },
    { title: "曼谷美食发现", subtitle },
    { title: "曼谷泰餐新体验", subtitle },
    { title: "泰餐必吃推荐", subtitle },
  ];
  if (location === "centralwOrld") {
    pairs.unshift(
      { title: "centralwOrld泰餐推荐", subtitle },
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
    ? `Dining location (system-provided): ${location}. Use it in the coverTitle only when it is the strongest hook. Do NOT invent Terminal 21 / Siam Center / One Bangkok.`
    : "No dining mall keyword is available. Do NOT invent centralwOrld, Terminal 21, Siam Center, or One Bangkok.";

  return `COVER OVERLAY — JSON "mainTitle" (= coverTitle) + "subTitle" (= subtitle). Independent from titles[]. Never shorten titles[]. Never extra API calls. Generate both in THIS same JSON.

COVER TITLE (mainTitle)
Must naturally include AT LEAST ONE keyword from: 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃
Pick the ONE keyword that best matches this post. Two keywords are allowed if they still read as a headline. Never stuff 3+ pool keywords plus 推荐 into a keyword list.
Do NOT force every keyword into one title.
GOOD: 曼谷隐藏泰餐 / centralwOrld泰餐推荐 / 曼谷泰餐推荐 / 必吃泰式料理 / 曼谷美食发现 / 曼谷泰餐新体验
BAD: 曼谷centralwOrld泰餐美食必吃推荐 / 曼谷最好吃centralwOrld泰餐美食 / centralwOrld必吃
Style: short, eye-catching Xiaohongshu cover headline. Curiosity and click-through. Communicate what is special, why to click, and the strongest angle. Not a search-keyword list.
Length: 4–7 Chinese-character-equivalent units. Count Han as 1. Count centralwOrld as 1 unit total. Never 3. Never 8+. Do not truncate. Do not pad.
Previous coverTitle (do not copy): ${previousMain}

COVER SUBTITLE (subTitle)
Do NOT use a fixed template such as 招牌泰式料理 / 家常泰式料理.
Analyze FEEL tags, the customer's own sentences, meal cost, restaurant traits, KSP, dining scenario, and unique points. Extract the strongest reason someone would save or click. Rewrite it concisely. Do not copy the original sentence. Do not repeat the coverTitle.
Priority: 1 unique experience 2 food highlight 3 atmosphere 4 price/value 5 location convenience 6 emotional reaction.
Length: 6–10 units. Never empty. Never 5 or shorter. Never 11+.

Customer evidence for subtitle (INTERNAL):
- Dining note: ${note}
- Meal spend: ${amount}
- Enjoy-most tags: ${enjoy}
- Selected dishes: ${dishes}
- Visit: ${context.visitFrequency || "none"} / ${context.customerType || "none"}
${locationHint}

EXAMPLES (learn the method; do not copy unless the evidence matches):
Dining note "第一次吃到可以自己DIY打抛饭，觉得很有趣，而且味道很像泰国家常菜"
→ mainTitle 曼谷泰餐新体验 / subTitle DIY打抛饭很好玩
"在centralwOrld逛街累了发现这家泰餐，环境很舒服，适合朋友聊天"
→ mainTitle centralwOrld泰餐推荐 / subTitle 逛街后舒服聚餐
"两个人吃了600泰铢，点了很多菜，份量很足"
→ mainTitle 曼谷必吃泰餐 / subTitle 两人600泰铢很满足

VALIDATE before return:
1) mainTitle contains at least one pool keyword and is not keyword stuffing.
2) subTitle is from this customer's actual input/context, has the strongest selling point, is not a generic restaurant line, does not repeat mainTitle, and does not copy the note verbatim.
If mainTitle is missing a required keyword, rewrite mainTitle in this same JSON. Do not make a second request.

FORBIDDEN except the allowed keyword 必吃: 第一 / 唯一 / 顶级 / 最强 / 最好吃 / 封神 / 全网第一 / 曼谷第一 / invented 泰国人爱吃 / 本地人爱吃 / 明星爱吃
Never copy customer negatives onto the cover. Never write 第一次美食冒险. No hashtag, address, hours, emoji, Location & Time. Never invent a dish.`;
}
