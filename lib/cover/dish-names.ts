export type OfficialDishName = {
  full: string;
  aliases: string[];
};

/** Menu dishes and common shortened forms. Always prefer `full` on the cover. */
export const OFFICIAL_COVER_DISHES: OfficialDishName[] = [
  {
    full: "黄咖喱蟹肉",
    aliases: ["yellow curry crab meat", "yellow curry crab", "curry crab", "黄咖喱蟹", "黄咖喱", "咖喱蟹"],
  },
  {
    full: "冬阴功虾汤",
    aliases: ["tom yum goong", "tom yum", "冬阴功"],
  },
  {
    full: "泰式酸甜蒸鱼",
    aliases: ["thai sweet & sour steamed fish", "sweet & sour steamed fish", "酸甜蒸鱼", "蒸鱼"],
  },
  {
    full: "蒜蓉炒虾",
    aliases: ["stir-fried shrimp with garlic", "garlic shrimp", "炒虾"],
  },
  {
    full: "芒果糯米饭",
    aliases: ["mango sticky rice", "芒果糯米", "糯米饭"],
  },
];

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

export function collectFullDishNames(input: {
  dishes?: string[];
  sourceTexts?: string[];
} = {}) {
  const dishes = input.dishes ?? [];
  const sources = [...(input.sourceTexts ?? []), ...dishes];
  const found: string[] = [];

  for (const item of OFFICIAL_COVER_DISHES) {
    const mentioned = sources.some(
      (text) => includesLoose(text, item.full) || item.aliases.some((alias) => includesLoose(text, alias)),
    );
    if (mentioned) found.push(item.full);
  }

  for (const dish of dishes) {
    const official = OFFICIAL_COVER_DISHES.find(
      (item) => item.full === dish || item.aliases.some((alias) => alias.toLowerCase() === dish.toLowerCase()),
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
      if (includesLoose(text, item.full)) found.push(item.full);
    }
  }

  return uniqueLongestFirst(found);
}

/** Replace shortened dish names with the complete name. Never truncates a full name. */
export function expandShortDishNames(text: string, fullNames: string[]) {
  let next = text;
  for (const full of uniqueLongestFirst(fullNames)) {
    if (!full || next.includes(full)) continue;
    for (const alias of aliasesFor(full)) {
      if (alias.length < 2 || !next.includes(alias)) continue;
      next = next.split(alias).join(full);
      break;
    }
  }
  return next;
}

export function formatFullDishNameRules(dishes: string[] = []) {
  const allowed = uniqueLongestFirst([
    ...OFFICIAL_COVER_DISHES.map((item) => item.full),
    ...dishes.filter((dish) => /[\u4e00-\u9fff]/.test(dish)),
  ]);
  return `FULL DISH NAMES — if mainTitle or subTitle mentions a dish, use the COMPLETE name. Never shorten for length.
Priority: 1) complete dish name already in this generation's titles/caption 2) the customer's selected/written dish 3) the menu names below 4) only then invent a complete name from context.
NEVER rewrite 黄咖喱蟹肉 as 咖喱蟹, 冬阴功虾汤 as 冬阴功, 泰式青咖喱鸡 as 青咖喱, or 泰式香辣打抛猪肉饭 as 打抛.
If the complete name makes mainTitle longer than 4–7 units, keep the dish name intact and shorten other words, or move the complete dish name into subTitle. Never split one dish name into broken pieces.
Allowed complete names for this customer: ${allowed.join(" / ") || "none — do not invent a dish"}`;
}
