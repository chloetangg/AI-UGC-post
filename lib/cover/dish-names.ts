import type { RecommendedDish } from "@/types/content";

export type OfficialDishName = {
  id: Exclude<RecommendedDish, "Others">;
  full: string;
  cover: string;
  aliases: string[];
};

/** Menu dishes. Cover overlay uses `cover`; titles/caption keep `full`. */
export const OFFICIAL_COVER_DISHES: OfficialDishName[] = [
  {
    id: "River Prawn Tom Yum",
    full: "河虾冬阴功汤",
    cover: "冬阴功",
    aliases: ["river prawn tom yum", "tom yum goong", "tom yum", "河虾冬阴功", "冬阴功汤", "冬阴功"],
  },
  {
    id: "Crab Meat Curry",
    full: "咖喱蟹肉",
    cover: "咖喱蟹肉",
    aliases: ["crab meat curry", "yellow curry crab meat", "curry crab meat", "蟹肉咖喱"],
  },
  {
    id: "Stir-Fried Morning Glory",
    full: "炒空心菜",
    cover: "炒空心菜",
    aliases: ["stir-fried morning glory", "morning glory", "water spinach", "空心菜"],
  },
  {
    id: "Pineapple Fried Rice",
    full: "菠萝炒饭",
    cover: "菠萝炒饭",
    aliases: ["pineapple fried rice", "pineapple rice"],
  },
  {
    id: "Mango Sticky Rice",
    full: "芒果糯米饭",
    cover: "芒果糯米饭",
    aliases: ["mango sticky rice", "芒果糯米", "糯米饭"],
  },
  {
    id: "Scrambled Egg Rice",
    full: "滑蛋饭",
    cover: "滑蛋饭",
    aliases: ["scrambled egg rice", "egg rice", "虾仁滑蛋饭", "蒜炒虾仁滑蛋饭"],
  },
  {
    id: "Lemon Sea Bass",
    full: "青柠蒸鲈鱼",
    cover: "青柠蒸鲈鱼",
    aliases: [
      "lemon sea bass",
      "lemon fish",
      "steamed sea bass with lime",
      "鲈鱼",
      "柠檬鲈鱼",
    ],
  },
  {
    id: "Garlic Shrimp",
    full: "蒜炒虾仁",
    cover: "蒜炒虾仁",
    aliases: ["garlic shrimp", "garlic prawns", "shrimp garlic"],
  },
  {
    id: "Sweet and Sour River Prawns",
    full: "酸甜酱炒河虾",
    cover: "酸甜酱炒河虾",
    aliases: ["sweet and sour river prawns", "sweet & sour river prawns", "酸甜河虾"],
  },
  {
    id: "Green Curry Beef",
    full: "青咖喱牛肉",
    cover: "青咖喱牛肉",
    aliases: ["green curry beef", "green curry"],
  },
];

const NEVER_REPLACE_ALIASES = new Set(["芒果", "菠萝", "鲈鱼", "空心菜"]);

const CUSTOM_SHORT_ALIASES = ["打抛", "冬阴功", "芒果糯米"];

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

export function chineseFullDishName(dish: string) {
  const key = dish.trim();
  if (!key || key === "Others") return key;
  const official = OFFICIAL_COVER_DISHES.find(
    (item) =>
      item.id === key ||
      item.full === key ||
      item.cover === key ||
      item.aliases.some((alias) => alias.toLowerCase() === key.toLowerCase()),
  );
  return official?.full ?? key;
}

export function allDishNameHints() {
  return uniqueLongestFirst(
    OFFICIAL_COVER_DISHES.flatMap((item) => [item.id, item.full, item.cover, ...item.aliases]),
  );
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
        includesLoose(text, item.id) ||
        item.aliases.some((alias) => includesLoose(text, alias)),
    );
    if (mentioned) found.push(item.full);
  }

  for (const dish of dishes) {
    const official = OFFICIAL_COVER_DISHES.find(
      (item) =>
        item.id === dish ||
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
    if (full === "芒果糯米饭" && /芒果(?!糯米)/.test(hay)) return true;
    if (full === "菠萝炒饭" && /菠萝(?!炒饭)/.test(hay)) return true;
    if (full === "青柠蒸鲈鱼" && hay.includes("鲈鱼") && !hay.includes("青柠蒸鲈鱼")) return true;
    if (full === "咖喱蟹肉" && /咖喱蟹(?!肉)/.test(hay)) return true;
    if (full === "青咖喱牛肉" && /青咖喱(?!牛肉)/.test(hay)) return true;
  }
  return false;
}

export function formatCoverDishNameRules(dishes: string[] = []) {
  const lines = OFFICIAL_COVER_DISHES.map((item) => `${item.full} → ${item.cover}`).join("\n");
  const allowed = uniqueLongestFirst([
    ...OFFICIAL_COVER_DISHES.map((item) => `${item.full}→${item.cover}`),
    ...dishes.filter((dish) => /[\u4e00-\u9fff]/.test(dish)),
  ]);
  return `COVER DISH NAMES — titles[] and caption still use the COMPLETE name. mainTitle / subTitle may only use these approved shorts (never invent another short):
${lines}
Never 冬阴功汤 if the approved short is 冬阴功. Never 芒果 / 菠萝 / 鲈鱼 / 青咖喱 / 咖喱蟹 as a cover short.
If a customer-written dish is not in this table, keep its complete name. Do not shorten 泰式青咖喱鸡 to 青咖喱 or 泰式香辣打抛猪肉饭 to 打抛.
A dish in subTitle is the ONE core reason — do not also add price or first-visit in the same line.
Allowed cover names for this customer: ${allowed.join(" / ") || "none — do not invent a dish"}`;
}

export function formatCaptionDishNameRules() {
  const caption = OFFICIAL_COVER_DISHES.map((item) => `- ${item.id} = ${item.full}`).join("\n");
  const cover = OFFICIAL_COVER_DISHES.map((item) => `- ${item.full} → ${item.cover}`).join("\n");
  return `titles[] and caption use COMPLETE Chinese names:
${caption}
COVER mainTitle / subTitle use ONLY these approved shorts (never invent another):
${cover}
If a customer-written dish has a complete name, keep that complete name. Never shorten to 青咖喱 or 打抛.
If a dish was not provided, do not name a specific dish.
Allowed cover dishes = only the recommended/mentioned list above. Never invent Pad Thai, Som Tam, or other unsupported dishes.`;
}

/** @deprecated Use formatCoverDishNameRules */
export function formatFullDishNameRules(dishes: string[] = []) {
  return formatCoverDishNameRules(dishes);
}
