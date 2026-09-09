import {
  isAcceptableCoverOverlay,
  isAcceptableMainTitle,
  layoutCoverOverlay,
  looksIncompleteCover,
} from "../lib/cover/cover-title";
import {
  countCoverUnits,
  coverKeywordPairKey,
  hasExactCoverKeywordPair,
} from "../lib/cover/cover-rules";

const samples = [
  ["曼谷必吃", "招牌泰式料理", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["泰餐必吃", "招牌菜值得试", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷泰餐", "超人气招牌菜", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷必吃泰餐", "家常泰式料理", ""],
  ["centralwOrld美食", "招牌泰式料理", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["One Bangkok美食", "特色泰式料理", "Baan Ying (One Bangkok, 3rd Floor)"],
  ["centralwOrld必吃", "特色招牌好味道", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷必吃", "centralwOrld泰餐", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷最近新开的", "", ""],
  ["这家店真的非常", "值得一去", ""],
  ["曼谷美食｜真的很", "泰餐", ""],
  ["真的太好拍", "随手拍都出片", ""],
] as const;

for (const [title, subtitle, branch] of samples) {
  const context = { branch };
  const ok = isAcceptableCoverOverlay(title, subtitle, [], context);
  const mainOk = isAcceptableMainTitle(title, [], context);
  const dangling = looksIncompleteCover(title);
  console.log(
    `${ok ? "OK" : "NO"} pair:${hasExactCoverKeywordPair(title, subtitle) ? "2" : "n"} main:${mainOk ? "Y" : "N"} ${countCoverUnits(title)}/${countCoverUnits(subtitle)} ${dangling ? "dangling" : "complete"} ${title} | ${subtitle}`,
  );
}

console.log("--- exact-2 repair + diversity ---");
const pairs = new Set<string>();
for (let index = 0; index < 10; index += 1) {
  const context = {
    branch: "Baan Ying (centralwOrld, 3rd Floor)",
    dishes: ["Tom Yum Goong"],
    variantIndex: index,
    contentAngleId: "CA-02",
    kspId: "KSP-01",
  };
  const overlay = layoutCoverOverlay("曼谷必吃泰餐", "招牌冬阴功", ["曼谷探店"], context);
  const exact = hasExactCoverKeywordPair(overlay.title, overlay.subtitle);
  const key = coverKeywordPairKey(overlay.title, overlay.subtitle);
  pairs.add(key);
  console.log(
    `${index} exact2:${exact ? "Y" : "N"} ${key || "none"} ${overlay.title} | ${overlay.subtitle}`,
  );
  if (!exact) {
    throw new Error(`cover must use exactly 2 pool keywords, got ${overlay.title} | ${overlay.subtitle}`);
  }
}
if (pairs.size < 2) {
  throw new Error(`expected keyword-pair diversity across 10 repairs, got ${[...pairs].join(", ")}`);
}
console.log(`distinct pairs in 10: ${[...pairs].join(" / ")}`);
