export const PRIMARY_BANGKOK_TITLE_KEYWORDS = [
  "曼谷美食推荐",
  "曼谷美食攻略",
  "曼谷吃什么",
  "曼谷探店",
  "曼谷泰餐",
  "曼谷泰菜",
  "曼谷餐厅",
  "曼谷吃饭",
  "曼谷美食",
] as const;

export const SECONDARY_BANGKOK_TITLE_KEYWORDS = [
  "曼谷餐厅推荐",
  "曼谷旅行美食",
  "曼谷逛街吃饭",
  "曼谷美食打卡",
  "曼谷美食分享",
  "曼谷泰国菜",
  "曼谷用餐",
  "泰国菜推荐",
  "泰国美食",
] as const;

export const BANGKOK_TITLE_KEYWORDS = [
  ...PRIMARY_BANGKOK_TITLE_KEYWORDS,
  ...SECONDARY_BANGKOK_TITLE_KEYWORDS,
] as const;

export type BangkokTitleKeyword = (typeof BANGKOK_TITLE_KEYWORDS)[number];

const KEYWORDS_BY_LENGTH = [...BANGKOK_TITLE_KEYWORDS].sort((a, b) => b.length - a.length);

export function stripHashtagsFromTitle(title: string) {
  return title
    .replace(/#[^\s#]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、｜|])/g, "$1")
    .trim();
}

export function keywordInTitle(title: string): BangkokTitleKeyword | "" {
  return KEYWORDS_BY_LENGTH.find((keyword) => title.includes(keyword)) ?? "";
}

export function keywordsFromTitles(titles: string[]) {
  return titles.map((title) => keywordInTitle(stripHashtagsFromTitle(title))).filter(Boolean);
}

export function preferredKeywords(previousKeywords: string[] = []) {
  const previous = new Set(previousKeywords.filter(Boolean));
  const fresh = BANGKOK_TITLE_KEYWORDS.filter((keyword) => !previous.has(keyword));
  const reused = BANGKOK_TITLE_KEYWORDS.filter((keyword) => previous.has(keyword));
  return [...fresh, ...reused];
}

export function evaluateTitleKeywords(
  titles: string[],
  previousKeywords: string[] = [],
) {
  const cleaned = titles.map(stripHashtagsFromTitle);
  const keywords = cleaned.map(keywordInTitle);
  const unique = [...new Set(keywords.filter(Boolean))];
  const previous = new Set(previousKeywords.filter(Boolean));
  const freshCount = keywords.filter((keyword) => keyword && !previous.has(keyword)).length;
  const missingIndexes = keywords
    .map((keyword, index) => (keyword ? -1 : index))
    .filter((index) => index >= 0);
  const reasons: string[] = [];

  if (cleaned.length < 3) reasons.push("Need exactly 3 titles.");
  if (missingIndexes.length > 0) {
    reasons.push(`Titles missing a Bangkok food keyword: ${missingIndexes.map((i) => i + 1).join(", ")}.`);
  }
  if (unique.length === 1 && keywords.filter(Boolean).length >= 3) {
    reasons.push(`All 3 titles use the same keyword: ${unique[0]}.`);
  }
  if (previous.size > 0 && freshCount < 2) {
    reasons.push("At least 2 titles must use keywords different from previousTitleKeywords.");
  }

  return {
    ok: reasons.length === 0 && cleaned.length >= 3 && missingIndexes.length === 0,
    keywords,
    uniqueCount: unique.length,
    freshCount,
    missingIndexes,
    reasons,
  };
}

function nextUnusedKeyword(used: Set<string>, previous: Set<string>, pool: readonly string[]) {
  return (
    pool.find((keyword) => !used.has(keyword) && !previous.has(keyword)) ||
    pool.find((keyword) => !used.has(keyword)) ||
    pool[0] ||
    "曼谷美食"
  );
}

/**
 * Last-resort repair: guarantee one relevant keyword per title and keyword diversity.
 * Does not invent dishes or experiences; only inserts/replaces search keywords.
 */
export function ensureTitleKeywords(
  titles: [string, string, string],
  previousKeywords: string[] = [],
): [string, string, string] {
  const previous = new Set(previousKeywords.filter(Boolean));
  const pool = preferredKeywords(previousKeywords);
  const used = new Set<string>();

  const repaired = titles.map((raw) => {
    let title = stripHashtagsFromTitle(raw);
    let keyword: string = keywordInTitle(title);

    if (!keyword) {
      keyword = nextUnusedKeyword(used, previous, pool);
      const flag = title.startsWith("🇹🇭") ? "🇹🇭" : "";
      const rest = title.replace(/^🇹🇭\s*/, "");
      title = rest.startsWith(keyword) ? `${flag}${rest}` : `${flag}${keyword}，${rest}`;
    } else if (used.has(keyword)) {
      const replacement = nextUnusedKeyword(used, previous, pool);
      title = title.replace(keyword, replacement);
      keyword = keywordInTitle(title) || replacement;
    } else if (previous.has(keyword) && used.size < 2) {
      const replacement = nextUnusedKeyword(used, previous, pool);
      if (replacement !== keyword) {
        title = title.replace(keyword, replacement);
        keyword = keywordInTitle(title) || replacement;
      }
    }

    if (keyword) used.add(keyword);
    return title;
  }) as [string, string, string];

  const check = evaluateTitleKeywords(repaired, previousKeywords);
  if (check.ok || check.missingIndexes.length === 0) return repaired;
  return repaired;
}

export function formatTitleKeywordRules() {
  return `TITLE SEARCH KEYWORDS — natural, not stuffed.
Each of the 3 titles must naturally contain at least one Bangkok food search keyword from the strategy library (primary preferred; secondary allowed).
Prefer 3 different keywords in the same generation. Integrate them as a real Xiaohongshu title, not SEO glue.
Do NOT require the same keyword in every title.
Do NOT use 必吃 / 最好吃 / 封神 / 顶级 / 曼谷第一 as a title hook.
Never use the same stuffed pattern in all 3 titles (e.g. 曼谷超好吃泰餐 / 曼谷超地道泰餐 / 曼谷超温馨泰餐).
Do not claim 明星 / 网红 / 排队 unless the customer wrote that.
No hashtags in titles.`;
}
