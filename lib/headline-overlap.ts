const DISH_NAMES = [
  "河虾冬阴功汤",
  "酸甜酱炒河虾",
  "青柠蒸鲈鱼",
  "芒果糯米饭",
  "青咖喱牛肉",
  "咖喱蟹肉",
  "蒜炒虾仁",
  "菠萝炒饭",
  "炒空心菜",
  "滑蛋饭",
  "冬阴功",
  "粉红奶",
  "泰奶",
];

/** Dish-bound claims. Words in the same family are not synonyms unless listed together. */
const DISH_CLAIMS: ReadonlyArray<readonly [string, RegExp]> = [
  ["下饭", /下饭/],
  ["配料", /配料/],
  ["新鲜", /新鲜/],
  ["酸辣", /酸辣/],
  ["软糯", /软糯/],
  ["酥脆", /酥脆/],
  ["嫩", /嫩滑|很嫩|超嫩/],
  ["入味", /入味/],
  ["椰香", /椰香味?(?:是真的|真的|确实)?(?:很|特别|超)?足/],
  ["香", /香喷喷|超香|很香|特别香/],
  ["鲜", /鲜美|很鲜|超鲜/],
  ["甜", /很甜|超甜|甜甜/],
  ["辣", /很辣|超辣|辣辣/],
  ["酸", /很酸|酸酸/],
  ["正宗", /正宗/],
  ["再点", /回购|想再点|还会点/],
  ["好吃", /太好炫|好好炫|好炫|很好吃|超好吃|太好吃|好好吃|好吃/],
  ["喜欢", /喜欢/],
];

const VISIT_CLAIMS = new Set(["来店", "服务", "氛围"]);

type HeadlinePoint = { dish: string; claims: string[] };
type AlternatePrefer = "theme" | "dish" | "angle";

function plainLine(text: string) {
  return text.replace(/\p{Extended_Pictographic}/gu, "").replace(/^🇹🇭/u, "").replace(/这口/g, "").trim();
}

function dishIn(text: string) {
  return DISH_NAMES.find((name) => text.includes(name)) ?? "";
}

function sameDish(left: string, right: string) {
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function claimsOf(plain: string, dish: string) {
  const rest = dish ? plain.split(dish).join("") : plain;
  const claims = new Set<string>();
  for (const [id, pattern] of DISH_CLAIMS) {
    if (pattern.test(rest)) claims.add(id);
  }
  if (/朋友|介绍/.test(plain) || (/推荐/.test(rest) && !dish)) claims.add("来店");
  if (/服务|店员|热情|周到/.test(rest)) claims.add("服务");
  if (/温馨|氛围/.test(rest)) claims.add("氛围");
  return [...claims];
}

function pointOf(text: string): HeadlinePoint {
  const plain = plainLine(text);
  const dish = dishIn(plain);
  return { dish, claims: claimsOf(plain, dish) };
}

function isThemeLine(text: string) {
  const point = pointOf(text);
  return !point.dish && point.claims.length === 0 && /商场|逛街|泰餐|这家店/.test(plainLine(text));
}

/**
 * Same dish plus the same confirmed claim. A different claim, a bare dish name,
 * or the same word on two different dishes is not a repeat.
 */
export function headlinesSharePoint(left: string, right: string) {
  const a = pointOf(left);
  const b = pointOf(right);
  const dishesDiffer = Boolean(a.dish && b.dish && !sameDish(a.dish, b.dish));
  return a.claims.some((claim) => {
    if (!b.claims.includes(claim)) return false;
    if (VISIT_CLAIMS.has(claim)) return !dishesDiffer || claim === "来店";
    if (dishesDiffer) return false;
    if (a.dish && b.dish) return true;
    return !a.dish && !b.dish;
  });
}

function evidenceLines(input: { note?: string; recommendTo?: string[]; enjoyMost?: string[] }) {
  return [input.note ?? "", ...(input.recommendTo ?? []), ...(input.enjoyMost ?? [])]
    .flatMap((item) => item.split(/[。！？!?\n，,]/))
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function usableLine(text: string) {
  const point = pointOf(text);
  if (point.claims.includes("来店") || point.claims.includes("氛围")) return true;
  if (point.dish && point.claims.some((claim) => !VISIT_CLAIMS.has(claim))) return true;
  if (point.claims.includes("服务") && /服务|店员/.test(text)) return true;
  return isThemeLine(text);
}

function alternateRank(text: string, prefer: AlternatePrefer) {
  const point = pointOf(text);
  const theme = point.claims.includes("来店") || point.claims.includes("氛围") || isThemeLine(text);
  const dishEval = Boolean(point.dish && point.claims.some((claim) => !VISIT_CLAIMS.has(claim)));
  if (prefer === "dish") return dishEval ? 0 : theme ? 1 : 2;
  return theme ? 0 : dishEval ? 1 : 2;
}

function keepDecoration(previous: string, next: string) {
  const flag = previous.trimStart().startsWith("🇹🇭") ? "🇹🇭" : "";
  const body = next.replace(/\p{Extended_Pictographic}/gu, "").replace(/^🇹🇭/u, "").trim();
  const emoji = previous.replace(/^🇹🇭/u, "").match(/\p{Extended_Pictographic}/u)?.[0] ?? "";
  if (!emoji || !sameDish(dishIn(plainLine(previous)), dishIn(body))) return `${flag}${body}`;
  return previous.trim().endsWith(emoji) ? `${flag}${body}${emoji}` : `${flag}${emoji}${body}`;
}

function pickAlternate(current: string, blocked: string[], lines: string[], prefer: AlternatePrefer) {
  const used = blocked.filter(Boolean);
  return (
    lines
      .filter((line) => usableLine(line) && plainLine(line) !== plainLine(current))
      .filter((line) => !used.some((item) => headlinesSharePoint(line, item) || plainLine(line) === plainLine(item)))
      .sort((left, right) => alternateRank(left, prefer) - alternateRank(right, prefer))[0] ?? ""
  );
}

export function separateOverlappingHeadlines(input: {
  titles: [string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  note?: string;
  recommendTo?: string[];
  enjoyMost?: string[];
}) {
  const lines = evidenceLines(input);
  const titles: [string, string, string] = [...input.titles];
  let coverTitle = input.coverTitle;
  let coverSubtitle = input.coverSubtitle;
  const frozen = () => [titles[1], titles[2]];
  let coverLocked = false;
  let subtitleLocked = false;
  let titleLocked = false;

  if (headlinesSharePoint(coverTitle, coverSubtitle)) {
    const nextCover = pickAlternate(coverTitle, [coverSubtitle, titles[0], ...frozen()], lines, "theme");
    if (nextCover) {
      coverTitle = keepDecoration(coverTitle, nextCover);
      coverLocked = true;
    } else {
      const nextSubtitle = pickAlternate(coverSubtitle, [coverTitle, titles[0], ...frozen()], lines, "dish");
      if (nextSubtitle) {
        coverSubtitle = keepDecoration(coverSubtitle, nextSubtitle);
        subtitleLocked = true;
      }
    }
  }

  if (headlinesSharePoint(coverTitle, titles[0])) {
    const nextTitle = titleLocked ? "" : pickAlternate(titles[0], [coverTitle, coverSubtitle, ...frozen()], lines, "angle");
    if (nextTitle) {
      titles[0] = keepDecoration(titles[0], nextTitle);
      titleLocked = true;
    } else if (!coverLocked) {
      const nextCover = pickAlternate(coverTitle, [titles[0], coverSubtitle, ...frozen()], lines, "theme");
      if (nextCover) {
        coverTitle = keepDecoration(coverTitle, nextCover);
        coverLocked = true;
      }
    }
  }

  if (headlinesSharePoint(coverSubtitle, titles[0])) {
    const nextTitle = titleLocked ? "" : pickAlternate(titles[0], [coverTitle, coverSubtitle, ...frozen()], lines, "angle");
    if (nextTitle) {
      titles[0] = keepDecoration(titles[0], nextTitle);
    } else if (!subtitleLocked) {
      const nextSubtitle = pickAlternate(coverSubtitle, [coverTitle, titles[0], ...frozen()], lines, "dish");
      if (nextSubtitle) coverSubtitle = keepDecoration(coverSubtitle, nextSubtitle);
    }
  }

  return { titles, coverTitle, coverSubtitle };
}
