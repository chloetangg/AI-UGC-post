export type OfficialDishName = {
  full: string;
  cover: string;
  aliases: string[];
};

/** Menu dishes. Cover overlay uses `cover`; titles/caption keep `full`. */
export const OFFICIAL_COVER_DISHES: OfficialDishName[] = [
  {
    full: "黄咖喱蟹肉",
    cover: "咖喱蟹肉",
    aliases: ["yellow curry crab meat", "yellow curry crab", "curry crab", "黄咖喱蟹", "黄咖喱", "咖喱蟹肉", "咖喱蟹"],
  },
  {
    full: "冬阴功虾汤",
    cover: "冬阴功",
    aliases: ["tom yum goong", "tom yum", "冬阴功"],
  },
  {
    full: "泰式酸甜蒸鱼",
    cover: "泰式蒸鱼",
    aliases: ["thai sweet & sour steamed fish", "sweet & sour steamed fish", "酸甜蒸鱼", "泰式蒸鱼", "蒸鱼"],
  },
  {
    full: "蒜蓉炒虾",
    cover: "蒜蓉炒虾",
    aliases: ["stir-fried shrimp with garlic", "garlic shrimp", "炒虾"],
  },
  {
    full: "芒果糯米饭",
    cover: "芒果糯米饭",
    aliases: ["mango sticky rice", "芒果糯米", "糯米饭"],
  },
];

const NEVER_REPLACE_ALIASES = new Set(["芒果"]);

const CUSTOM_SHORT_ALIASES = ["打抛", "青咖喱", "冬阴功", "咖喱蟹", "芒果糯米"];

function includesLoose(hay: string, needle: string) {
  const text = hay.trim();
  const key = needle.trim();
  if (!text || !key) return false;
  return text.toLowerCase().includes(key.toLowerCase());
}

function uniqueLongestFirst(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
}

function customFragments(full: string) {
  const fragments: string[] = [];
  if (full.startsWith("泰式") && full.length > 4) fragments.push(full.slice(2));
  for (const short of CUSTOM_SHORT_ALIASES) {
    if (full.includes(short) && short !== full) fragments.push(short);
  }
  return fragments;
}

function aliasesFor(full: string) {
  const official = OFFICIAL_COVER_DISHES.find((item) => item.full === full);
  const chinese = (official?.aliases ?? []).filter((alias) => /[\u4e00-\u9fff]/.test(alias));
  return uniqueLongestFirst([...chinese, ...customFragments(full)]);
}

export function coverDishShortName(full: string) {
  return OFFICIAL_COVER_DISHES.find((item) => item.full === full)?.cover ?? full;
}

export function collectFullDishNames(input: {
  dishes?: string[];
  sourceTexts?: string[];
} = {}) {
  const dishes = input.dishes ?? [];
  const sources = [...(input.sourceTexts ?? []), ...dishes];
  const found: string[] = [];

  for (const item of OFFICIAL_COVER_DISHES) {
    const mentioned = sources.some(
      (text) =>
        includesLoose(text, item.full) ||
        includesLoose(text, item.cover) ||
        item.aliases.some((alias) => includesLoose(text, alias)),
    );
    if (mentioned) found.push(item.full);
  }

  for (const dish of dishes) {
    const official = OFFICIAL_COVER_DISHES.find(
      (item) =>
        item.full === dish ||
        item.cover === dish ||
        item.aliases.some((alias) => alias.toLowerCase() === dish.toLowerCase()),
    );
    if (official) {
      found.push(official.full);
      continue;
    }
    if (/[\u4e00-\u9fff]/.test(dish) && dish.trim().length >= 2) {
      found.push(dish.trim());
    }
  }

  for (const text of sources) {
    for (const item of OFFICIAL_COVER_DISHES) {
      if (includesLoose(text, item.full) || includesLoose(text, item.cover)) found.push(item.full);
    }
  }

  return uniqueLongestFirst(found);
}

export function mentionsCoverDishName(text: string, fullNames: string[] = []) {
  const hay = text.trim();
  if (!hay) return false;
  return collectFullDishNames({ dishes: fullNames, sourceTexts: [hay] }).some((full) => {
    const cover = coverDishShortName(full);
    return hay.includes(full) || hay.includes(cover);
  });
}

const DISH_TOKEN = "\u0001DISH\u0001";

/** Cover overlay only: rewrite to the approved short name. Never invent a new short. */
export function applyCoverDishShortNames(text: string, fullNames: string[]) {
  const names = uniqueLongestFirst([
    ...fullNames,
    ...collectFullDishNames({ dishes: fullNames, sourceTexts: [text] }),
  ]);
  let next = text;
  for (const full of names) {
    const cover = coverDishShortName(full);
    const terms = uniqueLongestFirst(
      [full, cover, ...aliasesFor(full)].filter((term) => term.length >= 2 && !NEVER_REPLACE_ALIASES.has(term)),
    );
    for (const term of terms) {
      if (!next.includes(term)) continue;
      next = next.split(term).join(DISH_TOKEN);
    }
    next = next.split(DISH_TOKEN).join(cover);
  }
  return next;
}

/** @deprecated Cover overlay now uses applyCoverDishShortNames. */
export function expandShortDishNames(text: string, fullNames: string[]) {
  return applyCoverDishShortNames(text, fullNames);
}

export function hasIllegalCoverDishShort(text: string, fullNames: string[] = []) {
  const names = collectFullDishNames({ dishes: fullNames, sourceTexts: [text] });
  const hay = text;
  for (const full of names) {
    if (full === "黄咖喱蟹肉") {
      if (/黄咖喱(?!蟹肉)/.test(hay)) return true;
      if (/咖喱蟹(?!肉)/.test(hay)) return true;
    }
    if (full === "泰式酸甜蒸鱼" && hay.includes("蒸鱼") && !hay.includes("泰式蒸鱼") && !hay.includes("泰式酸甜蒸鱼")) {
      return true;
    }
    if (full === "蒜蓉炒虾" && hay.includes("炒虾") && !hay.includes("蒜蓉炒虾")) return true;
    if (full === "芒果糯米饭" && /芒果(?!糯米饭)/.test(hay) && !hay.includes("芒果糯米")) return true;
  }
  return false;
}

export function formatCoverDishNameRules(dishes: string[] = []) {
  const allowed = uniqueLongestFirst([
    ...OFFICIAL_COVER_DISHES.map((item) => `${item.full}→${item.cover}`),
    ...dishes.filter((dish) => /[\u4e00-\u9fff]/.test(dish)),
  ]);
  return `COVER DISH NAMES — titles[] and caption still use the COMPLETE name. mainTitle / subTitle may only use these approved cover shorts (never invent another short):
黄咖喱蟹肉 → 咖喱蟹肉 (never 黄咖喱)
冬阴功虾汤 → 冬阴功
泰式酸甜蒸鱼 → 泰式蒸鱼 (never 蒸鱼)
蒜蓉炒虾 → 蒜蓉炒虾 (never 炒虾)
芒果糯米饭 → 芒果糯米饭 (never 芒果)
If a customer-written dish is not in this table, keep its complete name. Do not shorten 泰式青咖喱鸡 to 青咖喱 or 泰式香辣打抛猪肉饭 to 打抛.
A dish in subTitle is the ONE core reason — do not also add price or first-visit in the same line.
Allowed cover names for this customer: ${allowed.join(" / ") || "none — do not invent a dish"}`;
}

/** @deprecated Use formatCoverDishNameRules */
export function formatFullDishNameRules(dishes: string[] = []) {
  return formatCoverDishNameRules(dishes);
}
