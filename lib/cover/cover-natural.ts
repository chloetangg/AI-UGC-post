import { selectedCoverLocation, type CoverTitleContext } from "./cover-rules";

function sanitizeCoverLine(raw: string) {
  return raw
    .replace(/#[^\s#]+/g, "")
    .replace(/📍|⏰/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Complete Bangkok phrases that may appear naturally in a title. */
export const NATURAL_BANGKOK_PHRASES = [
  "曼谷必吃",
  "曼谷美食推荐",
  "曼谷美食攻略",
  "曼谷吃什么",
  "曼谷美食",
  "曼谷泰餐",
  "曼谷泰菜",
  "曼谷餐厅",
  "曼谷吃饭",
  "曼谷探店",
] as const;

const MECHANICAL_EXACT = new Set([
  "曼谷超爱次来吃",
  "曼谷很值得来吃",
  "曼谷推荐来吃",
  "曼谷好吃必吃",
  "曼谷美食来打卡",
  "曼谷超推荐吃",
  "曼谷爱吃这家",
  "曼谷好吃推荐必吃",
  "曼谷美食值得来吃",
  "曼谷超爱泰餐",
]);

const MECHANICAL_PATTERN =
  /超爱次来吃|爱次来吃|很值得来吃|推荐来吃$|好吃必吃|美食来打卡|超推荐吃|爱吃这家$|^曼谷超爱|^曼谷很值得|^曼谷推荐来|^曼谷好吃必|^曼谷超推荐|^曼谷爱吃这家/;

const BROKEN_REMAINDER =
  /^(超爱|很值得|推荐来吃|好吃必吃|超推荐吃|爱吃这家|次来吃|来吃|好吃推荐必吃|美食值得来吃|美食来打卡)/;

const NATURAL_SHORT_COVERS = ["曼谷泰餐推荐", "曼谷必吃泰菜", "曼谷吃什么？", "曼谷美食探店"] as const;

function headlineBody(title: string) {
  return sanitizeCoverLine(title)
    .replace(/🇹🇭/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[｜|].*$/, "")
    .trim();
}

export function remainderAfterBangkokPhrase(title: string) {
  let next = headlineBody(title);
  for (const phrase of [...NATURAL_BANGKOK_PHRASES].sort((a, b) => b.length - a.length)) {
    if (next.startsWith(phrase)) {
      return next.slice(phrase.length).replace(/^[｜|，、：:\s?？]+/, "");
    }
  }
  if (next.startsWith("曼谷")) return next.slice(2);
  return next;
}

export function isMechanicalKeywordGlue(title: string) {
  const cleaned = headlineBody(title);
  if (!cleaned) return true;
  if (MECHANICAL_EXACT.has(cleaned)) return true;
  if (MECHANICAL_PATTERN.test(cleaned)) return true;
  if (/超爱次|谷超爱次/.test(cleaned)) return true;
  const rest = remainderAfterBangkokPhrase(title);
  return Boolean(rest) && BROKEN_REMAINDER.test(rest);
}

const INCOMPLETE_ACTION_EXACT = new Set([
  "曼谷泰餐第一次来尝试",
  "曼谷美食第一次来体验",
  "centralwOrld泰餐第一次尝试",
  "曼谷泰餐值得来吃",
  "到曼谷第一次泰餐",
  "Baan Ying第一次来",
  "泰餐第一次来吃",
  "曼谷泰餐第一次体验",
  "曼谷美食第一次来吃",
  "曼谷泰餐值得尝试",
  "曼谷发现泰餐",
  "Baan Ying曼谷第一次",
]);

/** 第一次/尝试/体验/来吃/发现 hanging with no object, or keyword + action glue. */
export function isIncompleteCoverAction(title: string) {
  const cleaned = sanitizeCoverLine(title).replace(/\s+/g, "");
  if (!cleaned) return false;
  if (INCOMPLETE_ACTION_EXACT.has(cleaned)) return true;
  if (/(第一次(来)?|来)(尝试|体验)$/.test(cleaned)) return true;
  if (/第一次来$/.test(cleaned)) return true;
  if (/第一次来吃$/.test(cleaned)) return true;
  if (/值得(来吃|尝试)$/.test(cleaned)) return true;
  if (/第一次(泰餐|美食|曼谷)$/.test(cleaned)) return true;
  if (/到曼谷第一次(?!餐)/.test(cleaned)) return true;
  if (/发现(泰餐|美食)$/.test(cleaned) && !/发现(这家|一家)/.test(cleaned)) return true;
  if (/(曼谷|泰餐|美食|centralwOrld|Baan Ying)第一次$/.test(cleaned)) return true;
  return false;
}

export function isSpokenCompleteCoverHeadline(title: string) {
  const cleaned = sanitizeCoverLine(title).replace(/\s+/g, "");
  if (!cleaned || isIncompleteCoverAction(cleaned)) return false;
  return (
    /^第一次来(尝试|吃|试试|体验).{2,}$/.test(cleaned) ||
    /^第一次来(centralwOrld|Siam Center|Terminal 21|One Bangkok)吃/.test(cleaned) ||
    /^(在)?曼谷(吃到|发现|逛街发现)(一家|这家)/.test(cleaned) ||
    /^来曼谷(可以)?试试这家/.test(cleaned)
  );
}

export function repairIncompleteCoverAction(title: string, context: CoverTitleContext = {}) {
  const cleaned = sanitizeCoverLine(title);
  if (!isIncompleteCoverAction(cleaned)) return cleaned;
  const firstVisit = context.visitFrequency === "1st time" || /第一次/.test(cleaned);
  const mall = selectedCoverLocation(context.branch) || "centralwOrld";
  if (/central\s*world|siam\s*center|terminal\s*21|one\s*bangkok/i.test(cleaned) && firstVisit) {
    return `第一次来${mall}吃泰餐`;
  }
  if (/发现/.test(cleaned)) return "在曼谷发现这家泰餐";
  if (/值得/.test(cleaned)) return "来曼谷试试这家泰餐";
  if (/到曼谷第一次/.test(cleaned)) return "来曼谷试试这家泰餐";
  if (firstVisit && !context.diningNote?.trim() && (context.dishes ?? []).length === 0) {
    return "第一次来试试这家泰餐";
  }
  return "来曼谷试试这家泰餐";
}

export function isNaturalCoverChinese(title: string) {
  const cleaned = sanitizeCoverLine(title);
  if (!cleaned) return false;
  if (isMechanicalKeywordGlue(cleaned)) return false;
  if (isIncompleteCoverAction(cleaned)) return false;
  if (/(.)\1{2,}/.test(cleaned.replace(/centralwOrld/gi, ""))) return false;
  if (/[｜|/,，、]$/.test(cleaned)) return false;
  return true;
}

export function isUnnaturalHeadline(title: string) {
  return !isNaturalCoverChinese(title);
}

const BROKEN_DEGREE = /(?<!十)分(舒服|好吃|放松|温馨)/;
const REAL_DEGREE = /很|挺|比较|特别|十分|超|真的|蛮/;
const ATMOSPHERE_FACT = /氛围|环境|温馨|舒服|放松/;

export type DegreeRepairAction = "unchanged" | "evidence" | "fact" | "alternate" | "safe-failure";

export type DegreeRepair = {
  title: string;
  action: DegreeRepairAction;
  /** Why a broken degree title was kept, replaced, or sent to the existing safe title. */
  reason: string;
};

/** A degree fragment such as 分舒服 is not a title we can safely rewrite by swapping one character. */
export function fragmentedDegreeTitle(title: string) {
  return BROKEN_DEGREE.test(title.replace(/\p{Extended_Pictographic}/gu, ""));
}

function plainTitle(text: string) {
  return text.replace(/\p{Extended_Pictographic}/gu, "").replace(/^🇹🇭/u, "").trim();
}

function evidenceClauses(evidence: string[]) {
  return evidence
    .flatMap((item) => item.split(/[。！？!?\n，,]/))
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function withTitleFlag(previous: string, next: string) {
  const flag = previous.trimStart().startsWith("🇹🇭") ? "🇹🇭" : "";
  return `${flag}${plainTitle(next)}`;
}

/**
 * Broken degree titles are not left in the result.
 * A matching evidence sentence wins. A related fact is copied as written.
 * Otherwise an evidenced sibling title is used. The last resort is the existing
 * short cover fallback, which does not invent the missing evaluation.
 */
export function repairFragmentedDegreeTitle(title: string, evidence: string[], alternates: string[] = []): DegreeRepair {
  if (!fragmentedDegreeTitle(title)) return { title, action: "unchanged", reason: "" };
  const stem = title.match(BROKEN_DEGREE)?.[1] ?? "";
  const lines = evidenceClauses(evidence);
  const matched = lines.find((line) => stem && line.includes(stem) && !fragmentedDegreeTitle(line) && REAL_DEGREE.test(line));
  if (matched) return { title: withTitleFlag(title, matched), action: "evidence", reason: "used the evidence sentence with a complete degree" };
  const topic = stem === "好吃" ? /好吃|味道|口味/ : ATMOSPHERE_FACT;
  const fact = lines.find((line) => topic.test(line) && !fragmentedDegreeTitle(line));
  if (fact) {
    return {
      title: withTitleFlag(title, fact),
      action: "fact",
      reason: "used the evidenced atmosphere fact without adding the broken evaluation",
    };
  }
  const alternate = alternates.find((item) => {
    const plain = plainTitle(item);
    return plain && plain !== plainTitle(title) && !fragmentedDegreeTitle(item) && lines.some((line) => line.includes(plain) || plain.includes(line));
  });
  if (alternate) return { title: withTitleFlag(title, alternate), action: "alternate", reason: "used another title already supported by evidence" };
  return {
    title: withTitleFlag(title, naturalCoverFallback()),
    action: "safe-failure",
    reason: "no evidenced replacement for a broken degree title",
  };
}

export function formatCoverNaturalRules() {
  return `COVER TITLE NATURAL CHINESE CHECK — run before output. Additive.

Cover mainTitle is one complete, spoken Chinese headline. Not keyword glue.
Never output: 曼谷超爱次来吃 / 曼谷很值得来吃 / 曼谷推荐来吃 / 曼谷好吃必吃 / 曼谷美食来打卡 / 曼谷超推荐吃 / 曼谷爱吃这家.
After writing, check: subject-verb-object holds; collocation is native; no typo / missing / repeated character; not padded to fill length; a real Xiaohongshu user would write it; if 曼谷 is removed, the remainder still basically stands.
Keyword phrases may appear naturally: 曼谷必吃 / 曼谷美食 / 曼谷泰餐 / 曼谷吃什么 / 曼谷美食推荐 / 曼谷泰菜 / 曼谷餐厅 / 曼谷吃饭 / 曼谷美食攻略 / 曼谷探店.
The phrase is only part of the title. If it cannot sit naturally, pick another phrase. Never force 曼谷 onto a broken stub.
Prefer the customer's real note, favorite dish, reason, and restaurant plus. 老板很帅 → 老板很帅的曼谷泰餐. 蒜炒虾仁很Q弹 → 曼谷必吃. 适合带小朋友 → 曼谷吃什么？
10 units is a MAX, not a target. Prefer a short complete line over a stuffed 10-character line.
GOOD: 曼谷泰餐推荐 / 曼谷必吃泰菜 / 曼谷吃什么？ / 曼谷美食探店 / 老板很帅的曼谷泰餐
BAD: 曼谷超爱次来吃 / 曼谷好吃推荐必吃 / 曼谷美食值得来吃

ACTION OBJECTS — 第一次 / 尝试 / 体验 / 来到 / 吃 / 打卡 / 发现 / 逛 must be followed by a clear object or a complete spoken thought. Do not stack 地点/类别 + 动作 with no object.
A cover title is a sentence a real Chinese speaker would say, not 地点+关键词+动作+食物 glued together.
If packing one more keyword would break the grammar, keep the natural sentence.
Ask: 一个中国人正常聊天会这样说吗? If no, rebuild.

第一次来 is one possible angle, only for a first visit to Baan Ying. Never rewrite a broken line into 第一次吃泰餐, 到曼谷第一餐泰餐, or 曼谷泰餐第一次来尝试. Rebuild from this visit. Do not copy the example lines.`;
}

export function naturalCoverFallback(context: CoverTitleContext = {}, index = 0) {
  const note = `${context.diningNote ?? ""} ${(context.enjoyMost ?? []).join("")} ${(context.recommendTo ?? []).join("")}`;
  if (/老板/.test(note) && /帅|好看|英俊/.test(note)) return "老板很帅的曼谷泰餐";
  if (/Q弹|蒜香/.test(note)) return "曼谷必吃";
  if (/适合带小朋友|带娃|儿童/.test(note)) return "曼谷吃什么？";
  if (/逛街|逛完/.test(note)) return "曼谷美食探店";
  if (
    context.visitFrequency === "1st time" &&
    !context.diningNote?.trim() &&
    (context.dishes ?? []).length === 0 &&
    (context.enjoyMost ?? []).length === 0
  ) {
    return "第一次来试试这家泰餐";
  }
  return NATURAL_SHORT_COVERS[index % NATURAL_SHORT_COVERS.length] ?? "曼谷泰餐推荐";
}
