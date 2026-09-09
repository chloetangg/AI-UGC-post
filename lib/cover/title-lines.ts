const graphemeSegmenter = (() => {
  try {
    return new Intl.Segmenter("zh", { granularity: "grapheme" });
  } catch {
    return null;
  }
})();

function toGraphemes(text: string) {
  if (!text) return [];
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

export type TitleLines = {
  line1: string;
  line2: string;
};

const KEEP_TOGETHER = [
  "centralwOrld",
  "CentralWorld",
  "Terminal 21",
  "Siam Center",
  "One Bangkok",
  "Baan Ying",
  "泰国人",
  "新地标",
  "宝藏店",
  "太好拍",
  "好拍",
  "私藏",
  "很低调",
  "出片",
  "Baan Ying",
  "BaanYing",
  "真的好好吃",
  "真的太好吃",
  "真的可以了",
  "真的好吃",
  "真的可以",
  "真的绝了",
  "太可以了",
  "太好吃了",
  "太喜欢了",
  "必买清单",
  "隐藏版",
  "美食店",
  "去哪玩",
  "吃什么",
  "吃泰餐",
  "这家泰餐",
  "这家泰菜",
  "超好吃",
  "太好吃",
  "好好吃",
  "太香了",
  "很可以",
  "黄咖喱",
  "冬阴功",
  "芒果糯米",
  "来曼谷",
  "都来吃",
  "7-11",
  "7–11",
  "7—11",
  "餐厅推荐",
  "泰餐",
  "泰菜",
  "周末",
  "清单",
  "探店",
  "餐厅",
  "推荐",
  "家常",
  "温馨",
  "真香",
  "美食",
  "曼谷",
  "泰国",
  "这家",
  "真的",
  "必买",
] as const;

const LINE2_STARTS = [
  "新地标",
  "宝藏店",
  "太好拍",
  "私藏",
  "真的好好吃",
  "真的好吃",
  "真的可以",
  "真的绝了",
  "太可以了",
  "太好吃了",
  "好好吃",
  "超好吃",
  "太好吃",
  "太香了",
  "必买清单",
  "美食店",
  "去哪玩",
  "吃什么",
  "吃泰餐",
  "真的",
  "必买",
  "去哪",
  "推荐",
  "太",
  "超",
  "很",
] as const;

const LINE1_ENDS = [
  "泰国人",
  "这家泰餐",
  "这家泰菜",
  "隐藏版",
  "7-11",
  "7–11",
  "7—11",
  "泰餐",
  "泰菜",
  "周末",
  "曼谷",
  "泰国",
  "来曼谷",
  "都来吃",
] as const;

const BAD_LINE2_PREFIX = /^(版|餐|店|汤|饭|菜|厅|荐|11)/u;
const BAD_LINE1_SUFFIX = /(隐|藏|泰|美|食|7|-|–|—)$/u;

function isLatin(part: string) {
  return /^[A-Za-z]$/.test(part);
}

function isDigit(part: string) {
  return /^\d$/.test(part);
}

function isShopDash(part: string) {
  return part === "-" || part === "–" || part === "—";
}

const LOCATION_KEEP = [
  "centralwOrld",
  "Terminal 21",
  "Siam Center",
  "One Bangkok",
] as const;

function tokenize(graphemes: string[]): string[] {
  const atoms: string[] = [];
  let index = 0;
  while (index < graphemes.length) {
    const rest = graphemes.slice(index).join("");
    const location = LOCATION_KEEP.find((atom) =>
      rest.toLowerCase().startsWith(atom.toLowerCase()),
    );
    if (location) {
      atoms.push(rest.slice(0, location.length));
      index += location.length;
      continue;
    }
    const kept = KEEP_TOGETHER.find((atom) => rest.startsWith(atom));
    if (kept) {
      atoms.push(kept);
      index += toGraphemes(kept).length;
      continue;
    }

    if (isLatin(graphemes[index])) {
      let end = index + 1;
      while (end < graphemes.length && isLatin(graphemes[end])) end += 1;
      atoms.push(graphemes.slice(index, end).join(""));
      index = end;
      continue;
    }

    if (isDigit(graphemes[index])) {
      let end = index + 1;
      while (end < graphemes.length && isDigit(graphemes[end])) end += 1;
      if (end < graphemes.length && isShopDash(graphemes[end])) {
        let after = end + 1;
        if (after < graphemes.length && isDigit(graphemes[after])) {
          after += 1;
          while (after < graphemes.length && isDigit(graphemes[after])) after += 1;
          atoms.push(graphemes.slice(index, after).join(""));
          index = after;
          continue;
        }
      }
      atoms.push(graphemes.slice(index, end).join(""));
      index = end;
      continue;
    }

    atoms.push(graphemes[index]);
    index += 1;
  }

  const merged: string[] = [];
  for (const atom of atoms) {
    if (merged.length > 0 && /^[?？!！.。…~～]$/u.test(atom)) {
      merged[merged.length - 1] += atom;
      continue;
    }
    merged.push(atom);
  }
  return merged;
}

function scoreSplit(line1: string, line2: string) {
  const n1 = toGraphemes(line1).length;
  const n2 = toGraphemes(line2).length;
  let score = 0;

  if (n1 < 2 || n2 < 2) score -= 80;
  if (n1 === 1 || n2 === 1) score -= 40;
  score -= Math.abs(n1 - n2) * 3;

  if (LINE2_STARTS.some((item) => line2.startsWith(item))) score += 48;
  if (LINE1_ENDS.some((item) => line1.endsWith(item))) score += 36;
  if (line2.startsWith("美食店") || line2.startsWith("必买清单") || line2.startsWith("去哪玩")) {
    score += 12;
  }
  if (line1.endsWith("隐藏版") || line1.endsWith("7-11") || line1.endsWith("这家泰餐")) {
    score += 12;
  }

  if (BAD_LINE2_PREFIX.test(line2)) score -= 120;
  if (BAD_LINE1_SUFFIX.test(line1)) score -= 100;
  if (/\d$/.test(line1) && /^-/.test(line2)) score -= 160;
  if (/-$/.test(line1) && /^\d/.test(line2)) score -= 160;
  if (/[A-Za-z]$/.test(line1) && /^[A-Za-z]/.test(line2)) score -= 160;

  return score;
}

export type TitleLineOptions = {
  /** Titles at this length or shorter stay on one line. Default 5. */
  oneLineMax?: number;
};

const LATE_WRAP_TEMPLATE_IDS = new Set([
  "top-stroke",
  "bottom-bar",
  "bottom-card",
  "top-banner",
  "left-spine",
  "center-lower",
  "badge-stack",
  "polaroid",
]);

export function oneLineMaxForTemplate(templateId?: string) {
  return templateId && LATE_WRAP_TEMPLATE_IDS.has(templateId) ? 7 : 5;
}

/**
 * Font-independent cover title split. Never rewrites the title.
 * line1 + line2 === title.
 */
export function splitTitleIntoLines(title: string, options?: TitleLineOptions): TitleLines {
  const text = title ?? "";
  if (!text) return { line1: "", line2: "" };

  const graphemes = toGraphemes(text);
  const oneLineMax = options?.oneLineMax ?? 5;
  if (graphemes.length <= oneLineMax) {
    return { line1: text, line2: "" };
  }

  const atoms = tokenize(graphemes);
  if (atoms.length < 2) {
    return { line1: text, line2: "" };
  }

  let best: { line1: string; line2: string; score: number } | null = null;
  let prefix = "";
  for (let index = 0; index < atoms.length - 1; index += 1) {
    prefix += atoms[index];
    const line1 = prefix;
    const line2 = text.slice(line1.length);
    if (!line2 || line1 + line2 !== text) continue;
    const score = scoreSplit(line1, line2);
    if (!best || score > best.score) {
      best = { line1, line2, score };
    }
  }

  if (!best) {
    return { line1: text, line2: "" };
  }

  return { line1: best.line1, line2: best.line2 };
}
