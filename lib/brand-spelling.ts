import type { BranchConfig } from "@/lib/branches/types";

export const MALL_SPELLINGS = ["Centralworld", "centralworld"] as const;
export const RESTAURANT_SPELLINGS = ["Baan Ying", "baan ying"] as const;

export type MallSpelling = string;
export type RestaurantSpelling = (typeof RESTAURANT_SPELLINGS)[number];

export type BrandSpelling = {
  mall: MallSpelling;
  restaurant: RestaurantSpelling;
  mallPattern: RegExp;
};

function pickOne<T>(options: readonly T[]) {
  return options[Math.floor(Math.random() * options.length)] ?? options[0];
}

/** One pair per generation. Mall spellings come from the current branch. */
export function pickBrandSpelling(branch?: BranchConfig | null): BrandSpelling {
  const malls = branch?.mallSpellings?.length ? branch.mallSpellings : MALL_SPELLINGS;
  return {
    mall: pickOne(malls),
    restaurant: pickOne(RESTAURANT_SPELLINGS),
    mallPattern: branch?.mallPattern ?? /central\s*world/gi,
  };
}

function tightRestaurant(spelling: RestaurantSpelling) {
  return spelling === "Baan Ying" ? "BaanYing" : "baanying";
}

/**
 * Force every mall and restaurant mention onto this generation's spelling.
 * A spaced restaurant name stays spaced. A hashtag form stays unspaced.
 * The social app is 小红薯 in consumer copy.
 */
export function applyBrandSpelling(text: string, spelling: BrandSpelling) {
  if (!text) return text;
  const tight = tightRestaurant(spelling.restaurant);
  const pattern = new RegExp(spelling.mallPattern.source, "gi");
  const withMall = text.replace(pattern, spelling.mall);
  const withRestaurant = withMall.replace(/baan\s*ying/gi, (match, offset: number, full: string) => {
    const before = full.slice(0, offset);
    const hash = before.lastIndexOf("#");
    const inTag = hash >= 0 && !/[\s#]/.test(before.slice(hash + 1));
    return inTag ? tight : spelling.restaurant;
  });
  return withRestaurant.replaceAll("小红书", "小红薯");
}

export function formatPlatformNicknameRule() {
  return `PLATFORM NAME: when the diner names the app, write 小红薯. Do not write 小红书 in titles, caption, cover, or hashtags.`;
}

export function formatBrandSpellingRules(spelling: BrandSpelling) {
  const tight = tightRestaurant(spelling.restaurant);
  return `BRAND SPELLING — this generation only. Mall and restaurant are independent.
Mall, every time: ${spelling.mall}
Restaurant, every time: ${spelling.restaurant}
Use that same spelling in titles, caption, cover, and Location. Do not switch case mid-post, and do not name another branch's mall.
Hashtags use the same letters with no space: #${spelling.mall.replace(/\s+/g, "")} and #${tight}曼谷.`;
}
