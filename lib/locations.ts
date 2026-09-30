import { stripTrailingHashtagBlock } from "@/lib/hashtags";

export const BAAN_YING_BRANCHES = [
  "Baan Ying (centralwOrld, 3rd Floor)",
  "Baan Ying (Siam Center, 2nd Floor)",
  "Baan Ying (Terminal 21, 5th Floor)",
  "Baan Ying (One Bangkok, 3rd Floor)",
  "Baan Ying",
] as const;

export type BaanYingBranch = (typeof BAAN_YING_BRANCHES)[number];

/** System-assigned dining location. Customers no longer select a branch. */
export const DEFAULT_BAAN_YING_BRANCH: BaanYingBranch = "Baan Ying (centralwOrld, 3rd Floor)";

export function resolveDiningBranch(_branch?: string | null): BaanYingBranch {
  return DEFAULT_BAAN_YING_BRANCH;
}

const LEGACY_BAAN_YING_BRANCHES: Record<string, BaanYingBranch> = {
  "Baan Ying (CentralWorld, 5th Floor)": "Baan Ying (centralwOrld, 3rd Floor)",
  "Baan Ying (One Bangkok)": "Baan Ying (One Bangkok, 3rd Floor)",
  "Baan Ying (Siam Center)": "Baan Ying (Siam Center, 2nd Floor)",
};

export type BaanYingLocationId = "centralworld" | "siam" | "terminal21" | "onebangkok";

export type OfficialLocation = {
  id: BaanYingLocationId;
  englishName: string;
  /**
   * Explicitly provided Chinese mall name, or null if none exists.
   * null means: use the English mall name only. NEVER invent or translate one.
   */
  chineseName: string | null;
  floorEn: string;
  floorZh: string;
  officialLine: string;
  hours: string;
  hoursDisplay: string;
  surveyValue: BaanYingBranch;
};

export const OFFICIAL_LOCATIONS: Record<BaanYingLocationId, OfficialLocation> = {
  centralworld: {
    id: "centralworld",
    englishName: "centralwOrld",
    chineseName: "尚泰世界购物中心",
    floorEn: "3rd Floor",
    floorZh: "3楼",
    officialLine: "尚泰世界购物中心（centralwOrld）3楼",
    hours: "10:00–22:00",
    hoursDisplay: "10:00–22:00",
    surveyValue: "Baan Ying (centralwOrld, 3rd Floor)",
  },
  siam: {
    id: "siam",
    englishName: "Siam Center",
    chineseName: "暹罗中心",
    floorEn: "2nd Floor",
    floorZh: "2楼",
    officialLine: "暹罗中心（Siam Center）2楼",
    hours: "10:30–21:00",
    hoursDisplay: "10:30–21:00",
    surveyValue: "Baan Ying (Siam Center, 2nd Floor)",
  },
  terminal21: {
    id: "terminal21",
    englishName: "Terminal 21",
    chineseName: null,
    floorEn: "5th Floor",
    floorZh: "5楼",
    officialLine: "Terminal 21 5楼",
    hours: "10:00–22:00",
    hoursDisplay: "10:00–22:00",
    surveyValue: "Baan Ying (Terminal 21, 5th Floor)",
  },
  onebangkok: {
    id: "onebangkok",
    englishName: "One Bangkok",
    chineseName: null,
    floorEn: "3rd Floor",
    floorZh: "3楼",
    officialLine: "One Bangkok 3楼",
    hours:
      "Monday–Saturday 10:30–21:30; Sunday 10:30–21:00. If visit day is unknown, write 周一至周六 10:30–21:30｜周日 10:30–21:00. Do not claim the visit was on Sunday.",
    hoursDisplay: "周一至周六 10:30–21:30｜周日 10:30–21:00",
    surveyValue: "Baan Ying (One Bangkok, 3rd Floor)",
  },
};

export function branchKey(branch: string): BaanYingLocationId | "" {
  const value = branch.toLowerCase();
  if (
    value.includes("centralworld") ||
    value.includes("central world") ||
    value.includes("centralwOrld".toLowerCase()) ||
    branch.includes("尚泰世界购物中心") ||
    branch.includes("尚泰世界")
  ) {
    return "centralworld";
  }
  if (value.includes("siam center") || value.includes("siamcenter") || branch.includes("暹罗中心")) {
    return "siam";
  }
  if (value.includes("one bangkok") || value.includes("onebangkok")) return "onebangkok";
  if (
    value.includes("terminal 21") ||
    value.includes("terminal21") ||
    branch.includes("终端21") ||
    branch.includes("终点21")
  ) {
    return "terminal21";
  }
  return "";
}

/**
 * STRICT Mall Chinese Name Rules.
 * Injected into AI prompts. No Chinese mall name unless explicitly provided here.
 */
export const STRICT_MALL_CHINESE_NAME_RULES = `【STRICT Mall Chinese Name Rules — NO EXCEPTIONS】

Chinese mall names MUST NOT be invented, translated, guessed, or generated.
A Chinese caption does NOT authorize translating an English mall name into Chinese.
No Chinese name provided ≠ permission to translate.

ONLY these Chinese mall names are approved (from fixed location data):
- centralwOrld → 尚泰世界购物中心. Write 尚泰世界购物中心（centralwOrld）3楼
  The ONLY approved Chinese name is 尚泰世界购物中心. Never invent another one.
  PROHIBITED: 中央世界, 中央世界购物中心, 尚泰中央世界, 尚泰世界 (without 购物中心), 尚泰世界中心, or any other translation.
- Siam Center → 暹罗中心. Write 暹罗中心（Siam Center）2楼

For every other mall, if no Chinese name is explicitly provided: English mall name ONLY. Do not write any Chinese mall name.

Terminal 21 MUST ALWAYS remain "Terminal 21". NEVER translate, localize, or replace it.
PROHIBITED: 终端21, 终点21, Terminal 21购物中心, 曼谷Terminal 21购物中心, or any other invented Chinese name.
Correct: Terminal 21 5楼
Incorrect: 终端21 5楼

One Bangkok MUST ALWAYS remain "One Bangkok". No Chinese mall name has been provided. Do not create or translate one.
Correct: One Bangkok 3楼
Do not generate any Chinese translation or localized name.

If the system does not have an explicitly provided Chinese mall name: English mall name only. NEVER translate the English mall name into Chinese just because the caption is Simplified Chinese.`;

export function locationFactsForPrompt() {
  const cw = OFFICIAL_LOCATIONS.centralworld;
  const siam = OFFICIAL_LOCATIONS.siam;
  const t21 = OFFICIAL_LOCATIONS.terminal21;
  const ob = OFFICIAL_LOCATIONS.onebangkok;
  return {
    chineseNameRules: STRICT_MALL_CHINESE_NAME_RULES,
    branchRules: `- ${cw.englishName}: English MUST be spelled exactly "${cw.englishName}" (capital O only). Approved Chinese name: ${cw.chineseName} ONLY. Floor: ${cw.floorZh} / ${cw.floorEn}. In Chinese write ${cw.officialLine}. NEVER write CentralWorld, Central World, CENTRALWORLD, centralworld, 中央世界, 中央世界购物中心, 尚泰中央世界, 尚泰世界中心, or 尚泰世界 without 购物中心.
- ${siam.englishName}: English "${siam.englishName}". Approved Chinese name: ${siam.chineseName}. Floor: ${siam.floorZh} / ${siam.floorEn}. In Chinese write ${siam.officialLine}.
- ${t21.englishName}: English "${t21.englishName}" only. chineseName is null — NO Chinese name provided. Floor: ${t21.floorZh} / ${t21.floorEn}. MUST write ${t21.officialLine}. NEVER 终端21 / 终点21 / Terminal 21购物中心 / any translation.
- ${ob.englishName}: English "${ob.englishName}" only. chineseName is null — NO Chinese name provided. Floor: ${ob.floorZh} / ${ob.floorEn}. MUST write ${ob.officialLine}. NEVER invent a Chinese translation.`,
    hours: `- Baan Ying at ${cw.officialLine}: ${cw.hours}
- Baan Ying at ${siam.officialLine}: ${siam.hours}
- Baan Ying at ${ob.officialLine}: ${ob.hours}
- Baan Ying at ${t21.officialLine}: ${t21.hours}
- Generic "Baan Ying" with no mall: do not invent hours.`,
    examples: `📍 ${cw.officialLine}
📍 ${siam.officialLine}
📍 ${t21.officialLine}
📍 ${ob.officialLine}`,
  };
}

export function verifiedHoursForBranch(branch: string) {
  const key = branchKey(branch);
  return key ? OFFICIAL_LOCATIONS[key].hours : "";
}

export function officialLocationLine(branch: string) {
  const key = branchKey(branch);
  return key ? OFFICIAL_LOCATIONS[key].officialLine : "";
}

export function captionHoursForBranch(branch: string) {
  const key = branchKey(branch);
  return key ? OFFICIAL_LOCATIONS[key].hoursDisplay : "";
}

export const LOCATION_TIME_FORMAT_IDS = ["A", "B", "C", "D", "E", "F"] as const;
export type LocationTimeFormatId = (typeof LOCATION_TIME_FORMAT_IDS)[number];

/** Internal A–F = Version 1–6. Do not invent a 7th template. */
export const LOCATION_TIME_VERSION: Record<LocationTimeFormatId, 1 | 2 | 3 | 4 | 5 | 6> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
};

/** Version 2 / 5 require official hours. Version 1 / 6 may omit hours. Version 3 / 4 never output hours. */
export const FORMATS_NEEDING_HOURS: readonly LocationTimeFormatId[] = ["B", "E"];
export const FORMATS_SHOWING_HOURS: readonly LocationTimeFormatId[] = ["A", "B", "E", "F"];

const FORBIDDEN_LOCATION_REWRITES = [
  "CentralWorld",
  "Centralworld",
  "Central World",
  "CENTRALWORLD",
  "中央世界",
  "尚泰中央世界",
  "尚泰世界中心",
  "终端21",
  "终点21",
  "Terminal 21 Bangkok",
  "One Bangkok 曼谷",
] as const;

const INVENTED_CENTRALWORLD_ZH = [
  "尚泰中央世界购物中心",
  "中央世界购物中心",
  "中环世界购物中心",
  "尚泰中央世界",
  "中央世界广场",
  "尚泰世界中心",
  "中环世界",
  "中央世界",
] as const;

/** Replace invented Chinese names for centralwOrld with 尚泰世界购物中心. */
export function sanitizeOfficialMallNames(text: string) {
  if (!text) return text;
  const official = OFFICIAL_LOCATIONS.centralworld.chineseName;
  if (!official) return text;
  let next = text;
  const invented = [...INVENTED_CENTRALWORLD_ZH].sort((a, b) => b.length - a.length);
  for (const name of invented) {
    next = next.split(name).join(official);
  }
  next = next.replace(/尚泰世界(?!购物中心)/g, official);
  return next;
}

const ONE_BANGKOK_HOURS = "周一至周六 10:30–21:30｜周日 10:30–21:00";

export const LOCATION_PLACEMENTS = ["standalone", "inline"] as const;
export type LocationPlacement = (typeof LOCATION_PLACEMENTS)[number];

export const INLINE_LOCATION_STYLES = ["location", "location-hours"] as const;
export type InlineLocationStyle = (typeof INLINE_LOCATION_STYLES)[number];

export const INLINE_LOCATION_SLOTS = ["opening", "later"] as const;
export type InlineLocationSlot = (typeof INLINE_LOCATION_SLOTS)[number];

export type LocationTimePlan = {
  placement: LocationPlacement;
  format: LocationTimeFormatId | "";
  inlineStyle: InlineLocationStyle | "";
  inlineSlot: InlineLocationSlot | "";
};

export const LOCATION_TIME_FORMAT_POOL = `【Location & Time — 6 LOCKED TEMPLATES — STANDALONE ONLY】

These 6 templates are for standalone Location & Time. The system appends one after the caption in standalone mode.
Do NOT invent a 7th format. Do NOT rewrite the 6 template sentences.
Official 地点 / 时间 facts never change. Version only changes presentation.

Version 1
📍 地点
⏰ 时间

Version 2
就在 📍 地点，营业时间是 ⏰ 时间

Version 3 — location only, even when hours exist
这家分店就在📍 地点

Version 4 — location only, even when hours exist
喜欢泰餐的快来📍 地点 试试吧！

Version 5
赶紧码住📍 地点， ⏰ 时间， 下次来曼谷直接冲！

Version 6
Baan Ying
📍 地点
⏰ 时间

If official hours are missing: Version 1 and 6 omit ⏰; Version 2 and 5 cannot be used; Version 3 and 4 are allowed.
Never invent hours. Never change mall names, floors, centralwOrld casing, or One Bangkok weekday/Sunday hours.`;

export function isLocationTimeFormatId(value: unknown): value is LocationTimeFormatId {
  return LOCATION_TIME_FORMAT_IDS.includes(value as LocationTimeFormatId);
}

export function isLocationTimeSection(section: string) {
  return classifyLocationTimeSection(section) !== "";
}

function classifyLocationTimeSection(section: string): LocationTimeFormatId | "" {
  const text = section.trim();
  if (!text) return "";
  if (/^赶紧码住📍/.test(text)) return "E";
  if (/^喜欢泰餐的快来📍/.test(text)) return "D";
  if (/^这家分店就在📍/.test(text)) return "C";
  if (/^就在\s*📍/.test(text) && /营业时间/.test(text)) return "B";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0] === "Baan Ying" && lines.some((line) => line.startsWith("📍"))) return "F";
  if (lines[0]?.startsWith("📍") && lines.some((line) => line.startsWith("⏰"))) return "A";
  if (lines.length === 1 && lines[0]?.startsWith("📍")) return "A";
  return "";
}

const TRAILING_LOCATION_PATTERNS = [
  /\n*赶紧码住📍[^\n]+，\s*⏰[^\n]+，\s*下次来曼谷直接冲！\s*$/u,
  /\n*喜欢泰餐的快来📍[^\n]+试试吧！\s*$/u,
  /\n*这家分店就在📍[^\n]+\s*$/u,
  /\n*就在\s*📍[^\n]+，营业时间是\s*⏰[^\n]+\s*$/u,
  /\n*Baan Ying\n+\s*📍[^\n]+\n+\s*⏰[^\n]+\s*$/u,
  /\n*Baan Ying\n+\s*📍[^\n]+\s*$/u,
  /\n*📍[^\n]+\n+\s*⏰[^\n]+\s*$/u,
  /\n*📍[^\n]+\s*$/u,
];

function peelTrailingLocationTime(caption: string) {
  let text = stripTrailingHashtagBlock(caption).trimEnd();
  for (let i = 0; i < 4; i += 1) {
    const matched = TRAILING_LOCATION_PATTERNS.find((pattern) => pattern.test(text));
    if (!matched) break;
    text = text.replace(matched, "").trimEnd();
  }
  const parts = text.split(/\n\s*\n/);
  if (parts.length >= 2 && isLocationTimeSection(parts[parts.length - 1] ?? "")) {
    return parts.slice(0, -1).join("\n\n").trim();
  }
  return text.trim();
}

export function stripGeneratedLocationTime(caption: string) {
  return peelTrailingLocationTime(caption);
}

export function detectLocationTimeFormat(caption: string): LocationTimeFormatId | "" {
  const withoutHashtags = stripTrailingHashtagBlock(caption).trimEnd();
  const parts = withoutHashtags.split(/\n\s*\n/);
  return classifyLocationTimeSection(parts[parts.length - 1] ?? "");
}

function allowedLocationTimeFormats(hasHours: boolean) {
  return LOCATION_TIME_FORMAT_IDS.filter((id) => hasHours || !FORMATS_NEEDING_HOURS.includes(id));
}

export function pickNextLocationTimeFormat(
  previous: LocationTimeFormatId | "" = "",
  recent: LocationTimeFormatId[] = [],
  hasHours = true,
): LocationTimeFormatId {
  const allowed = allowedLocationTimeFormats(hasHours);
  const notPrevious =
    previous && isLocationTimeFormatId(previous) ? allowed.filter((id) => id !== previous) : allowed;
  const pool = notPrevious.length > 0 ? notPrevious : allowed;
  const unused = pool.filter((id) => !recent.includes(id));
  const prefer = unused.length > 0 ? unused : pool;
  return prefer[Math.floor(Math.random() * prefer.length)] ?? "C";
}

export function captionLocationLine(branch: string) {
  return officialLocationLine(branch) || "Baan Ying";
}

export function resolveLocationTimeFormat(
  format: LocationTimeFormatId | "" | undefined,
  hasHours: boolean,
  previous: LocationTimeFormatId | "" = "",
  recent: LocationTimeFormatId[] = [],
): LocationTimeFormatId {
  const allowed = allowedLocationTimeFormats(hasHours);
  if (
    format &&
    isLocationTimeFormatId(format) &&
    allowed.includes(format) &&
    format !== previous
  ) {
    return format;
  }
  return pickNextLocationTimeFormat(previous, recent, hasHours);
}

export function renderLocationTimeSection(
  format: LocationTimeFormatId,
  locationLine: string,
  hoursDisplay: string,
): string {
  switch (format) {
    case "A":
      return hoursDisplay ? `📍 ${locationLine}\n⏰ ${hoursDisplay}` : `📍 ${locationLine}`;
    case "B":
      return hoursDisplay
        ? `就在 📍 ${locationLine}，营业时间是 ⏰ ${hoursDisplay}`
        : renderLocationTimeSection("C", locationLine, "");
    case "C":
      return `这家分店就在📍 ${locationLine}`;
    case "D":
      return `喜欢泰餐的快来📍 ${locationLine} 试试吧！`;
    case "E":
      return hoursDisplay
        ? `赶紧码住📍 ${locationLine}， ⏰ ${hoursDisplay}， 下次来曼谷直接冲！`
        : renderLocationTimeSection("C", locationLine, "");
    case "F":
      return hoursDisplay
        ? `Baan Ying\n📍 ${locationLine}\n⏰ ${hoursDisplay}`
        : `Baan Ying\n📍 ${locationLine}`;
  }
}

function formatShowsHours(format: LocationTimeFormatId, hoursDisplay: string) {
  return Boolean(hoursDisplay) && FORMATS_SHOWING_HOURS.includes(format);
}

export function locationTimePassesSelfCheck(
  caption: string,
  branch: string,
  previous: LocationTimeFormatId | "" = "",
  expectedFormat?: LocationTimeFormatId,
) {
  const locationLine = captionLocationLine(branch);
  const hoursDisplay = captionHoursForBranch(branch);
  const detected = detectLocationTimeFormat(caption);
  if (!detected) return false;
  if (expectedFormat && detected !== expectedFormat) return false;
  if (previous && detected === previous) return false;
  if (!hoursDisplay && FORMATS_NEEDING_HOURS.includes(detected)) return false;

  const section = renderLocationTimeSection(detected, locationLine, hoursDisplay);
  if (!caption.trimEnd().endsWith(section)) return false;
  if (!section.includes(locationLine)) return false;
  if (FORBIDDEN_LOCATION_REWRITES.some((item) => section.includes(item))) return false;
  if (/#/.test(section)) return false;

  if (formatShowsHours(detected, hoursDisplay) && !section.includes(`⏰ ${hoursDisplay}`)) return false;
  if ((detected === "C" || detected === "D") && /⏰/.test(section)) return false;
  if (!hoursDisplay && /⏰/.test(section)) return false;

  const key = branchKey(branch);
  if (key === "centralworld" && !section.includes("centralwOrld")) return false;
  if (key === "terminal21" && !section.includes("Terminal 21")) return false;
  if (key === "onebangkok" && !section.includes("One Bangkok")) return false;
  if (key === "onebangkok" && formatShowsHours(detected, hoursDisplay) && !section.includes(ONE_BANGKOK_HOURS)) {
    return false;
  }
  return true;
}

export function attachOfficialLocationTime(
  caption: string,
  branch: string,
  format: LocationTimeFormatId | "" | undefined = "",
  previous: LocationTimeFormatId | "" = "",
  recent: LocationTimeFormatId[] = [],
) {
  const story = sanitizeOfficialMallNames(stripGeneratedLocationTime(caption)).trim();
  const locationLine = captionLocationLine(branch);
  const hoursDisplay = captionHoursForBranch(branch);
  const hasHours = Boolean(hoursDisplay);

  const build = (id: LocationTimeFormatId) => {
    const section = renderLocationTimeSection(id, locationLine, hoursDisplay);
    return {
      caption: `${story}\n\n${section}`,
      format: id,
      placement: "standalone" as const,
    };
  };

  let resolved = resolveLocationTimeFormat(format, hasHours, previous, recent);
  let result = build(resolved);
  if (!locationTimePassesSelfCheck(result.caption, branch, previous, resolved)) {
    resolved = pickNextLocationTimeFormat(previous, recent, hasHours);
    result = build(resolved);
  }
  return result;
}

export function isLocationPlacement(value: unknown): value is LocationPlacement {
  return LOCATION_PLACEMENTS.includes(value as LocationPlacement);
}

export function isInlineLocationStyle(value: unknown): value is InlineLocationStyle {
  return INLINE_LOCATION_STYLES.includes(value as InlineLocationStyle);
}

export function isInlineLocationSlot(value: unknown): value is InlineLocationSlot {
  return INLINE_LOCATION_SLOTS.includes(value as InlineLocationSlot);
}

export function officialLocationForBranch(branch: string) {
  const key = branchKey(resolveDiningBranch(branch));
  return key ? OFFICIAL_LOCATIONS[key] : null;
}

export function pickNextLocationPlacement(previous: LocationPlacement | "" = ""): LocationPlacement {
  if (previous === "standalone") return Math.random() < 0.8 ? "inline" : "standalone";
  if (previous === "inline") return Math.random() < 0.8 ? "standalone" : "inline";
  return Math.random() < 0.5 ? "standalone" : "inline";
}

export function resolveLocationPlacement(
  requested?: LocationPlacement | "",
  previous: LocationPlacement | "" = "",
): LocationPlacement {
  if (isLocationPlacement(requested) && requested !== previous) return requested;
  return pickNextLocationPlacement(previous);
}

export function detectLocationPlacement(caption: string, branch: string): LocationPlacement | "" {
  if (detectLocationTimeFormat(caption)) return "standalone";
  if (captionMentionsRestaurantName(caption) || captionMentionsOfficialLocation(caption, branch)) {
    return "inline";
  }
  return "";
}

export const OFFICIAL_RESTAURANT_NAME = "Baan Ying";

export function captionMentionsRestaurantName(caption: string) {
  return /Baan\s*Ying/i.test(stripGeneratedLocationTime(caption));
}

export function normalizeRestaurantNameCasing(text: string) {
  return text.replace(/baan\s*ying/gi, OFFICIAL_RESTAURANT_NAME);
}

export function captionMentionsOfficialLocation(caption: string, branch: string) {
  const story = stripGeneratedLocationTime(caption);
  const location = officialLocationForBranch(branch);
  if (!location) return captionMentionsRestaurantName(story);
  return (
    story.includes(location.englishName) ||
    Boolean(location.chineseName && story.includes(location.chineseName)) ||
    story.includes(location.officialLine)
  );
}

const GENERIC_RESTAURANT_RE = [
  /一家泰式餐厅/,
  /一家泰餐馆/,
  /一家泰餐厅/,
  /这家泰餐餐厅/,
  /这家泰式餐厅/,
  /这家泰餐馆/,
  /这家泰餐厅/,
  /这家泰餐(?!厅|馆)/,
  /这家餐厅/,
];

const MEAL_TO_RESTAURANT_RE: Array<[RegExp, string]> = [
  [/来吃泰餐/, `来${OFFICIAL_RESTAURANT_NAME}吃泰餐`],
  [/去吃泰餐/, `去${OFFICIAL_RESTAURANT_NAME}吃泰餐`],
  [/来吃饭/, `来${OFFICIAL_RESTAURANT_NAME}吃饭`],
  [/去吃饭/, `去${OFFICIAL_RESTAURANT_NAME}吃饭`],
  [/来试试这家/, `来试试${OFFICIAL_RESTAURANT_NAME}`],
  [/发现这家/, `发现${OFFICIAL_RESTAURANT_NAME}`],
];

function replaceFirst(text: string, pattern: RegExp, value: string) {
  return text.replace(pattern, value);
}

/** Keep restaurant identity in the caption body without a fixed address dump. */
export function ensureCaptionRestaurantName(caption: string, branch: string) {
  const story = normalizeRestaurantNameCasing(caption).trim();
  if (!story) return story;
  if (captionMentionsRestaurantName(story)) return story;

  for (const pattern of GENERIC_RESTAURANT_RE) {
    if (pattern.test(story)) {
      return replaceFirst(story, pattern, OFFICIAL_RESTAURANT_NAME);
    }
  }

  const location = officialLocationForBranch(branch);
  const floorZh = location?.floorZh ?? "";
  if (floorZh && story.includes(floorZh) && !story.includes(`${floorZh}的${OFFICIAL_RESTAURANT_NAME}`)) {
    return story.replace(floorZh, `${floorZh}的${OFFICIAL_RESTAURANT_NAME}`);
  }

  for (const [pattern, value] of MEAL_TO_RESTAURANT_RE) {
    if (pattern.test(story)) return replaceFirst(story, pattern, value);
  }

  const mentionsMall = Boolean(
    location &&
      (story.includes(location.englishName) ||
        Boolean(location.chineseName && story.includes(location.chineseName))),
  );
  if (mentionsMall && /(逛到肚子饿|逛了一圈|逛完|逛街)/.test(story)) {
    const floorPrefix = floorZh ? `${floorZh}的` : "";
    return story.replace(/(逛到肚子饿|逛了一圈|逛完|逛街)/, `$1，去了${floorPrefix}${OFFICIAL_RESTAURANT_NAME}`);
  }

  const weaves = floorZh
    ? [`去了${floorZh}的${OFFICIAL_RESTAURANT_NAME}`, `来${OFFICIAL_RESTAURANT_NAME}吃泰餐`, `刚好去了${OFFICIAL_RESTAURANT_NAME}`]
    : [`来${OFFICIAL_RESTAURANT_NAME}吃泰餐`, `刚好去了${OFFICIAL_RESTAURANT_NAME}`, `来${OFFICIAL_RESTAURANT_NAME}吃饭`];
  const weave = weaves[story.length % weaves.length] ?? `来${OFFICIAL_RESTAURANT_NAME}吃泰餐`;
  const parts = story.split(/(?<=[。！？\n])/u);
  const first = parts[0] ?? "";
  const rest = parts.slice(1).join("");
  if (first && /[。！？]$/.test(first)) {
    return `${first.slice(0, -1)}，${weave}${first.slice(-1)}${rest}`;
  }
  if (first) return `${first.replace(/[，,]+$/, "")}，${weave}。${rest}`;
  return `${weave}。${story}`;
}

export function planLocationTime(input: {
  branch: string;
  placement?: LocationPlacement | "";
  format?: LocationTimeFormatId | "";
  previousPlacement?: LocationPlacement | "";
  previousFormat?: LocationTimeFormatId | "";
  recentFormats?: LocationTimeFormatId[];
  inlineStyle?: InlineLocationStyle | "";
  inlineSlot?: InlineLocationSlot | "";
}): LocationTimePlan {
  const placement = resolveLocationPlacement(input.placement, input.previousPlacement);
  const hasHours = Boolean(captionHoursForBranch(input.branch));
  if (placement === "standalone") {
    return {
      placement,
      format: resolveLocationTimeFormat(
        input.format,
        hasHours,
        input.previousFormat,
        input.recentFormats ?? [],
      ),
      inlineStyle: "",
      inlineSlot: "",
    };
  }
  return {
    placement,
    format: "",
    inlineStyle: isInlineLocationStyle(input.inlineStyle)
      ? input.inlineStyle
      : hasHours && Math.random() < 0.5
        ? "location-hours"
        : "location",
    inlineSlot: isInlineLocationSlot(input.inlineSlot)
      ? input.inlineSlot
      : Math.random() < 0.5
        ? "opening"
        : "later",
  };
}

export function formatLocationTimeStaticRules() {
  return `LOCATION DISPLAY MODE (locationDisplayMode / THIS ROUND LOCATION PLAN) — official facts only. Follow that one mode only. Never mix inline and standalone logic.

HARD RULES:
- Restaurant name, mall, floor, and hours come only from official restaurant data. Never invent a branch, floor, address, exit, BTS/MRT, or extra brand fact.
- centralwOrld must keep this exact casing. Never CentralWorld / Central World / central world / centralworld.
- The only approved Chinese mall name is 尚泰世界购物中心. Never 中央世界 / 中央世界购物中心 / 尚泰中央世界 / 尚泰世界中心 / 尚泰世界 without 购物中心.
- If hours appear, they must be the official locked hours. Never change the time to sound natural.
- Do not invent 刚好路过 / 看到招牌 / 朋友推荐 / 下班后来 / 从BTS走过来 / 离某个出口很近 unless the customer wrote that.

RESTAURANT IDENTITY — BOTH MODES:
- The caption body itself must identify the restaurant. A reader who never looks at Location & Time must know this is Baan Ying.
- Prefer official restaurant name Baan Ying. Do not only write the mall (centralwOrld) when Baan Ying is available.
- Location & Time is NEVER the only restaurant identifier. Standalone ≠ skip the restaurant name.
- If the customer already named the restaurant, mall, floor, or branch, keep their wording and tone; only tidy grammar. Do not rewrite into ad/探店 copy.

INLINE (locationDisplayMode=inline):
- Baan Ying and official place facts become part of the story. No 📍/⏰ block. Do not append Location & Time.
- Recommended natural combos — not all required every time: Baan Ying / Baan Ying+mall / Baan Ying+floor / Baan Ying+mall+floor.
- Vary where it appears: opening / middle / with the mall / with the meal / with how the restaurant feels. Do not reuse the same address sentence.
- Good: 这次在centralwOrld逛街，刚好来3楼的Baan Ying吃泰餐。
- Bad: 今天带大家探店Baan Ying，这家位于centralwOrld 3楼的泰式餐厅非常有特色……

STANDALONE (locationDisplayMode=standalone):
- Caption still MUST naturally mention Baan Ying. The system appends one locked Version 1–6 Location & Time after the caption.
- Do not write 📍/⏰ / hours / Location & Time yourself.
- Caption may mention mall/floor as story. Location & Time only supplements the full place/hours.

FORBIDDEN mechanical fills:
- Baan Ying位于centralwOrld 3楼
- Every post 这次来到Baan Ying / 今天带大家探店Baan Ying
- Official promo tone, fixed openings, SEO-repeat of Baan Ying+mall+floor unless the story needs all three

CHECKS before return:
1) Caption alone names the restaurant
2) Mode not mixed
3) Customer opinion / tone / details kept
4) Restaurant name is part of the story, not stuffed
5) Official facts only
6) Do not stack Baan Ying+mall+floor unless the story needs all three
Hashtags stay out of the caption.`;
}

export function formatLocationTimePlanRules(plan: LocationTimePlan, branch: string) {
  const location = officialLocationForBranch(branch);
  const locationLine = location?.officialLine || officialLocationLine(branch) || OFFICIAL_RESTAURANT_NAME;
  const hoursDisplay = captionHoursForBranch(branch) || "none — do not invent hours";
  const previousHint =
    plan.placement === "standalone"
      ? `THIS ROUND LOCATION PLAN: standalone (locationDisplayMode=standalone). Caption MUST naturally mention ${OFFICIAL_RESTAURANT_NAME}. Do NOT write Location & Time, 📍, ⏰, or hours. The system appends locked Version ${plan.format ? LOCATION_TIME_VERSION[plan.format] : "1–6"} after your caption. Location & Time is supplementary only. Mall/floor may appear as story if natural.`
      : `THIS ROUND LOCATION PLAN: inline (locationDisplayMode=inline). Weave ${OFFICIAL_RESTAURANT_NAME} and the official place into the caption as story. Prefer ${OFFICIAL_RESTAURANT_NAME}; do not only write the mall. No 📍/⏰ block. No Location & Time after the story.
Style: ${plan.inlineStyle === "location-hours" && hoursDisplay !== "none — do not invent hours" ? "location + official hours" : "location only, no hours"}.
Slot: ${plan.inlineSlot === "opening" ? "earlier in the caption if the story can carry it" : "mid/later in the caption"}. Place it wherever the story can carry it.
If hours are requested, use the official hours exactly (${hoursDisplay}). 10点到22点 is allowed only when those are the same official numbers.`;

  return `Official restaurant name (locked): ${OFFICIAL_RESTAURANT_NAME}
Official dining location (locked): ${locationLine}
Official hours (locked): ${hoursDisplay}
${previousHint}
Do not invent a shopping / passing-by / transit reason unless the dining note supports it.`;
}

export function finalizeOfficialLocationTime(input: {
  caption: string;
  branch: string;
  placement?: LocationPlacement | "";
  format?: LocationTimeFormatId | "";
  previousPlacement?: LocationPlacement | "";
  previousFormat?: LocationTimeFormatId | "";
  recentFormats?: LocationTimeFormatId[];
  inlineStyle?: InlineLocationStyle | "";
  inlineSlot?: InlineLocationSlot | "";
}) {
  const plan = planLocationTime(input);
  const story = ensureCaptionRestaurantName(
    sanitizeOfficialMallNames(stripGeneratedLocationTime(input.caption)),
    input.branch,
  );

  if (plan.placement === "inline") {
    return { caption: story, placement: "inline" as const, format: "" as const };
  }

  return attachOfficialLocationTime(
    story,
    input.branch,
    plan.format,
    input.previousFormat,
    input.recentFormats ?? [],
  );
}

export function normalizeBaanYingBranch(value: unknown): BaanYingBranch | "" {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if ((BAAN_YING_BRANCHES as readonly string[]).includes(trimmed)) {
    return trimmed as BaanYingBranch;
  }
  if (trimmed in LEGACY_BAAN_YING_BRANCHES) {
    return LEGACY_BAAN_YING_BRANCHES[trimmed];
  }
  const key = branchKey(trimmed);
  return key ? OFFICIAL_LOCATIONS[key].surveyValue : "";
}
