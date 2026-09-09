import { branchKey, OFFICIAL_LOCATIONS, type BaanYingLocationId } from "@/lib/locations";
import { sanitizeCoverLine, toCoverGraphemes } from "./cover-title-text";

export const COVER_LOCATION_KEYWORDS = [
  "centralwOrld",
  "Terminal 21",
  "Siam Center",
  "One Bangkok",
] as const;

export const COVER_GENERIC_KEYWORDS = ["曼谷", "泰餐", "美食", "必吃"] as const;

/** Cover titles must use exactly two of these, across mainTitle + subTitle. */
export const COVER_POOL_KEYWORDS = ["曼谷", "centralwOrld", "泰餐", "美食", "必吃"] as const;

export const COVER_MANDATORY_KEYWORDS = [
  ...COVER_GENERIC_KEYWORDS,
  ...COVER_LOCATION_KEYWORDS,
] as const;

/** Latin mall names count as compact CJK-equivalent units, not 1 unit per letter. */
export const COVER_LOCATION_UNITS: Record<(typeof COVER_LOCATION_KEYWORDS)[number], number> = {
  centralwOrld: 4,
  "Terminal 21": 4,
  "Siam Center": 4,
  "One Bangkok": 4,
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
  { match: /yellow curry|咖喱蟹|黄咖喱/i, subtitle: "招牌咖喱蟹" },
  { match: /tom yum|冬阴功/i, subtitle: "招牌冬阴功" },
  { match: /sweet\s*&\s*sour|酸甜.*鱼|蒸鱼/i, subtitle: "招牌酸甜鱼" },
  { match: /garlic|蒜蓉|炒虾/i, subtitle: "蒜蓉炒虾" },
  { match: /mango|芒果糯米/i, subtitle: "芒果糯米饭" },
];

export type CoverTitleContext = {
  branch?: string;
  dishes?: string[];
  postTitles?: string[];
  previousCoverTitle?: string;
  variantIndex?: number;
  kspId?: string;
  contentAngleId?: string;
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

export function hasExactCoverKeywordPair(mainTitle: string, subTitle = "") {
  return uniqueCoverPoolKeywords(mainTitle, subTitle).length === 2;
}

export function coverKeywordPairKey(mainTitle: string, subTitle = "") {
  return uniqueCoverPoolKeywords(mainTitle, subTitle).slice().sort().join("+");
}

/**
 * Chinese-character-equivalent units for cover length rules.
 * Han = 1. Approved Latin mall names = 4. Other Latin/digits = 0.5, rounded up.
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

export function isCoverKeywordStuffing(mainTitle: string, subTitle = "") {
  const unique = uniqueCoverPoolKeywords(mainTitle, subTitle);
  if (unique.length > 2) return true;
  const combined = `${mainTitle}${subTitle}`;
  return unique.some((keyword) => {
    const pattern = new RegExp(escapeRegExp(keyword), "gi");
    const matches = combined.match(pattern) ?? [];
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

export function coverFallbackPairs(context: CoverTitleContext = {}) {
  const location = selectedCoverLocation(context.branch);
  const dish = dishSubtitle(context.dishes);
  const ksp = dish || "招牌泰式料理";
  const kspWarm = dish || "家常泰式料理";
  const kspTaste = dish || "特色招牌好味道";
  const kspTry = dish || "招牌菜值得试";
  const pairs = [
    { title: "曼谷必吃", subtitle: ksp },
    { title: "曼谷美食", subtitle: kspWarm },
    { title: "曼谷泰餐", subtitle: ksp },
    { title: "泰餐必吃", subtitle: ksp },
    { title: "美食必吃", subtitle: kspWarm },
    { title: "必吃泰餐", subtitle: kspTry },
    { title: "曼谷探店", subtitle: "必吃招牌料理" },
    { title: "特色泰餐", subtitle: "曼谷招牌料理" },
    { title: "美食推荐", subtitle: "泰餐招牌味道" },
    { title: "必吃推荐", subtitle: "曼谷招牌料理" },
  ];
  if (location === "centralwOrld") {
    pairs.push(
      { title: "centralwOrld美食", subtitle: ksp },
      { title: "centralwOrld泰餐", subtitle: ksp },
      { title: "centralwOrld必吃", subtitle: kspTaste },
      { title: "曼谷探店", subtitle: "centralwOrld分店" },
    );
  }
  return pairs;
}

export function formatCoverTitleRules(context: CoverTitleContext = {}) {
  const location = selectedCoverLocation(context.branch);
  const previousPair = coverKeywordPairKey(context.previousCoverTitle ?? "");
  const locationHint = location
    ? `Dining location (system-provided): ${location}. It is ONE optional keyword in the pool, never mandatory. Use ${location} as one of the two keywords only when it naturally strengthens this KSP. Do NOT force it into every cover. Do NOT invent Terminal 21 / Siam Center / One Bangkok.`
    : "No dining mall keyword is available. Do NOT invent centralwOrld, Terminal 21, Siam Center, or One Bangkok.";

  return `COVER OVERLAY — JSON "mainTitle" + "subTitle". Independent from titles[]. Never shorten titles[]. Never extra API calls. Generate both in THIS same JSON.

HARD LENGTH
- mainTitle: 4–7 Chinese-character-equivalent units ONLY. Never 3. Never 8+. Do not truncate. Do not pad with filler.
- subTitle: 4–9 units ONLY. Never 1–3. Never 10+. Do not truncate. Do not pad with filler.
- Count Han as 1. Count approved Latin mall names as about 4 units total (not 1 per letter): centralwOrld.
- If the chosen 2 keywords + KSP cannot fit, pick another valid 2-keyword combination. Never drop a keyword after writing.

EXACTLY 2 KEYWORDS from this pool, across mainTitle + subTitle combined:
曼谷 / centralwOrld / 泰餐 / 美食 / 必吃
Never 1. Never 3+. Never repeat the same keyword. Distribute them naturally (both in mainTitle, or 1+1).
Valid pairs include: 曼谷+泰餐 / 曼谷+美食 / 曼谷+必吃 / centralwOrld+美食 / centralwOrld+泰餐 / centralwOrld+必吃 / 泰餐+美食 / 泰餐+必吃 / 美食+必吃.
Do NOT always pick 曼谷+泰餐 or centralwOrld+美食. Avoid previous keyword pair: ${previousPair || "none"}.
${locationHint}

PRIORITY: KSP relevance > natural wording > content relevance > keyword diversity.
First lock the strongest real KSP from customer evidence / dishes / photos / selected KSP. Then pick the 2 keywords that support that KSP. Do not pick keywords at random. Do not force a keyword that weakens the KSP.

MAIN vs SUB must have different roles. Keywords are not the whole title. Subtitle must add KSP, not repeat the mainTitle formula.
GOOD: 曼谷必吃 + 招牌泰式料理 (keywords 曼谷/必吃; subtitle carries KSP)
GOOD: centralwOrld美食 + 招牌泰式料理 (keywords centralwOrld/美食)
GOOD: 泰餐必吃 + 招牌冬阴功 (keywords 泰餐/必吃; real dish only if selected)
BAD: 曼谷必吃泰餐 (3 keywords) / 曼谷必吃 + centralwOrld泰餐 (3+ keywords) / 曼谷必吃 + 曼谷美食 (repeat 曼谷) / same mainTitle every generation / keyword-only titles with no KSP.

STRUCTURES — rotate; do not copy these exact phrases:
A Location+hook: centralwOrld美食 + 招牌泰式料理
B Destination+recommend: 曼谷必吃 + 特色招牌料理
C Cuisine+hook: 泰餐必吃 + 招牌冬阴功
D Food+KSP: 曼谷美食 + 泰式招牌好味道
E Location+food: centralwOrld泰餐 + 人气招牌料理
Change word order, rhythm, and main/sub relationship across generations. Do not reuse the previous mainTitle, subTitle, keyword pair, or sentence formula unless the evidence truly requires it.

KSP is required. Never invent dishes, 老字号, 全曼谷最好吃, 曼谷第一, 必须打卡, 全网第一, 最好吃, TOP 1.

VALIDATE before return: mainTitle 4–7; subTitle 4–9; exactly 2 pool keywords; no keyword repeated; KSP present; different roles; natural Chinese; different from previous generation; no stuffing; no truncation.

FORBIDDEN on cover except the allowed keyword 必吃: 第一 / 唯一 / 顶级 / 最强 / 最好吃 / 封神 / 全网第一 / 曼谷第一 / invented 泰国人爱吃 / 本地人爱吃 / 明星爱吃
Never copy customer negatives onto mainTitle/subTitle: 贵 / 太贵 / 难吃 / 不好吃 / 踩雷 / 避雷 / 不推荐 / 不值得 / 失望 / 抽奖送东西 / 贵到吃不起 / 性价比低 / 很普通 / 没什么特别 / 服务不好 / 态度不好 / 不会回购.
If that information is relevant, keep the same meaning in neutral wording: 口味看个人喜好 / 整体风味比较经典 / 价格看个人预期 / 价格偏高 / 互动抽奖活动 / 曼谷特色泰餐 / centralwOrld美食. Do not invent praise.
No hashtag, address, hours, emoji, Location & Time. Never invent a dish. Optional real selected dish only.`;
}
