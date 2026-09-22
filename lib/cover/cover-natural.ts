import type { CoverTitleContext } from "./cover-rules";

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

export function isNaturalCoverChinese(title: string) {
  const cleaned = sanitizeCoverLine(title);
  if (!cleaned) return false;
  if (isMechanicalKeywordGlue(cleaned)) return false;
  if (/(.)\1{2,}/.test(cleaned.replace(/centralwOrld/gi, ""))) return false;
  if (/[｜|/,，、]$/.test(cleaned)) return false;
  return true;
}

export function isUnnaturalHeadline(title: string) {
  return !isNaturalCoverChinese(title);
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
If any check fails, do not output that title. Rebuild from customer evidence.`;
}

export function naturalCoverFallback(context: CoverTitleContext = {}, index = 0) {
  const note = `${context.diningNote ?? ""} ${(context.enjoyMost ?? []).join("")} ${(context.recommendTo ?? []).join("")}`;
  if (/老板/.test(note) && /帅|好看|英俊/.test(note)) return "老板很帅的曼谷泰餐";
  if (/Q弹|蒜香/.test(note)) return "曼谷必吃";
  if (/适合带小朋友|带娃|儿童/.test(note)) return "曼谷吃什么？";
  if (/逛街|逛完/.test(note)) return "曼谷美食探店";
  return NATURAL_SHORT_COVERS[index % NATURAL_SHORT_COVERS.length] ?? "曼谷泰餐推荐";
}
