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
    branchRules: `- ${cw.englishName}: English MUST be spelled exactly "${cw.englishName}" (capital O only). Approved Chinese name: ${cw.chineseName}. Floor: ${cw.floorZh} / ${cw.floorEn}. In Chinese write ${cw.officialLine}. NEVER write CentralWorld, Central World, CENTRALWORLD, centralworld, or 尚泰世界 without 购物中心.
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
  "终端21",
  "终点21",
  "Terminal 21 Bangkok",
  "One Bangkok 曼谷",
] as const;

const ONE_BANGKOK_HOURS = "周一至周六 10:30–21:30｜周日 10:30–21:00";

export const LOCATION_TIME_FORMAT_POOL = `【Location & Time — 6 LOCKED TEMPLATES — SYSTEM APPENDS, YOU DO NOT WRITE】

The system appends Location & Time after your caption. Do NOT write this block.
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
  const story = stripGeneratedLocationTime(caption).trim();
  const locationLine = captionLocationLine(branch);
  const hoursDisplay = captionHoursForBranch(branch);
  const hasHours = Boolean(hoursDisplay);

  const build = (id: LocationTimeFormatId) => {
    const section = renderLocationTimeSection(id, locationLine, hoursDisplay);
    return {
      caption: `${story}\n\n${section}`,
      format: id,
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
