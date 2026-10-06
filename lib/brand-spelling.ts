export const MALL_SPELLINGS = ["Centralworld", "centralworld"] as const;
export const RESTAURANT_SPELLINGS = ["Baan Ying", "baan ying"] as const;

export type MallSpelling = (typeof MALL_SPELLINGS)[number];
export type RestaurantSpelling = (typeof RESTAURANT_SPELLINGS)[number];

export type BrandSpelling = {
  mall: MallSpelling;
  restaurant: RestaurantSpelling;
};

function pickOne<T>(options: readonly T[]) {
  return options[Math.floor(Math.random() * options.length)] ?? options[0];
}

/** One pair per generation. Mall and restaurant are chosen independently. */
export function pickBrandSpelling(): BrandSpelling {
  return {
    mall: pickOne(MALL_SPELLINGS),
    restaurant: pickOne(RESTAURANT_SPELLINGS),
  };
}

function tightRestaurant(spelling: RestaurantSpelling) {
  return spelling === "Baan Ying" ? "BaanYing" : "baanying";
}

/**
 * Force every mall and restaurant mention onto this generation's spelling.
 * A spaced restaurant name stays spaced. A hashtag form stays unspaced.
 */
export function applyBrandSpelling(text: string, spelling: BrandSpelling) {
  if (!text) return text;
  const tight = tightRestaurant(spelling.restaurant);
  const withMall = text.replace(/central\s*world/gi, spelling.mall);
  return withMall.replace(/baan\s*ying/gi, (match, offset: number, full: string) => {
    const before = full.slice(0, offset);
    const hash = before.lastIndexOf("#");
    const inTag = hash >= 0 && !/[\s#]/.test(before.slice(hash + 1));
    return inTag ? tight : spelling.restaurant;
  });
}

export function formatBrandSpellingRules(spelling: BrandSpelling) {
  const tight = tightRestaurant(spelling.restaurant);
  return `BRAND SPELLING — this generation only. Mall and restaurant are independent.
Mall, every time: ${spelling.mall}
Restaurant, every time: ${spelling.restaurant}
Use that same spelling in titles, caption, cover, and Location. Do not switch case mid-post.
Forbidden: centralwOrld, CentralWorld, Central World, central World, Baan ying, baan Ying, BAAN YING.
Hashtags use the same letters with no space: #${spelling.mall} and #${tight}曼谷.`;
}
