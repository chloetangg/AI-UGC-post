import {
  isAcceptableCoverOverlay,
  isAcceptableMainTitle,
  layoutCoverOverlay,
  looksIncompleteCover,
} from "../lib/cover/cover-title";
import {
  countCoverUnits,
  hasCoverTitleKeyword,
} from "../lib/cover/cover-rules";

if (countCoverUnits("centralwOrld") !== 1) {
  throw new Error(`centralwOrld must count as 1 unit, got ${countCoverUnits("centralwOrld")}`);
}
if (countCoverUnits("centralwOrld泰餐推荐") !== 5) {
  throw new Error(`centralwOrld泰餐推荐 must count as 5 units, got ${countCoverUnits("centralwOrld泰餐推荐")}`);
}

const samples = [
  ["曼谷隐藏泰餐", "这顿泰餐让人想收藏", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷泰餐新体验", "DIY打抛饭很好玩", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["centralwOrld泰餐推荐", "逛街后舒服聚餐", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷必吃泰餐", "两人600泰铢很满足", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["centralwOrld必吃美食", "环境舒服适合慢慢聊", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["曼谷centralwOrld泰餐美食必吃推荐", "家常泰式料理", "Baan Ying (centralwOrld, 3rd Floor)"],
  ["One Bangkok美食", "特色泰式料理", "Baan Ying (One Bangkok, 3rd Floor)"],
  ["曼谷最近新开的", "", ""],
  ["这家店真的非常", "值得一去", ""],
  ["真的太好拍", "随手拍都出片", ""],
] as const;

for (const [title, subtitle, branch] of samples) {
  const context = { branch };
  const ok = isAcceptableCoverOverlay(title, subtitle, [], context);
  const mainOk = isAcceptableMainTitle(title, [], context);
  const dangling = looksIncompleteCover(title);
  console.log(
    `${ok ? "OK" : "NO"} kw:${hasCoverTitleKeyword(title) ? "Y" : "N"} main:${mainOk ? "Y" : "N"} ${countCoverUnits(title)}/${countCoverUnits(subtitle)} ${dangling ? "dangling" : "complete"} ${title} | ${subtitle}`,
  );
}

console.log("--- keyword + evidence repair ---");
const titles = new Set<string>();
for (let index = 0; index < 10; index += 1) {
  const context = {
    branch: "Baan Ying (centralwOrld, 3rd Floor)",
    dishes: ["Tom Yum Goong"],
    diningNote: "第一次吃到可以自己DIY打抛饭，觉得很有趣，而且味道很像泰国家常菜",
    mealAmount: 600,
    variantIndex: index,
    contentAngleId: "CA-02",
    kspId: "KSP-01",
  };
  const overlay = layoutCoverOverlay("曼谷泰餐新体验", "DIY打抛饭像在泰国家里吃饭", ["曼谷探店"], context);
  titles.add(overlay.title);
  console.log(`${index} kw:${hasCoverTitleKeyword(overlay.title) ? "Y" : "N"} ${overlay.title} | ${overlay.subtitle}`);
  if (!hasCoverTitleKeyword(overlay.title)) {
    throw new Error(`cover title must include a pool keyword, got ${overlay.title} | ${overlay.subtitle}`);
  }
}
console.log(`titles in 10: ${[...titles].join(" / ")}`);
