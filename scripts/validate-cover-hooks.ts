import {
  isAcceptableCoverOverlay,
  isAcceptableMainTitle,
  isAcceptableSubtitle,
  layoutCoverOverlay,
  looksIncompleteCover,
} from "../lib/cover/cover-title";
import {
  countCoverUnits,
  hasCoverTitleKeyword,
  inventsUnsupportedCoverClaim,
} from "../lib/cover/cover-rules";
import { applyCoverDishShortNames, hasIllegalCoverDishShort } from "../lib/cover/dish-names";
import { sanitizeCoverAbsoluteLanguage } from "../lib/cover/cover-absolute";

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
    dishes: ["River Prawn Tom Yum"],
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

if (applyCoverDishShortNames("最喜欢河虾冬阴功汤", ["河虾冬阴功汤"]) !== "最喜欢冬阴功") {
  throw new Error("cover must shorten 河虾冬阴功汤 to 冬阴功");
}
if (applyCoverDishShortNames("蒜炒虾仁滑蛋饭很好吃", ["蒜炒虾仁滑蛋饭"]) !== "虾仁滑蛋饭很好吃") {
  throw new Error("cover must shorten 蒜炒虾仁滑蛋饭 to 虾仁滑蛋饭");
}
if (applyCoverDishShortNames("蟹肉咖喱", ["蟹肉咖喱"]) !== "蟹肉咖喱") {
  throw new Error("蟹肉咖喱 should stay 蟹肉咖喱 on the cover");
}
if (hasIllegalCoverDishShort("青咖喱真的香", ["青咖喱牛肉"])) {
  /* expected */
} else {
  throw new Error("青咖喱 must be illegal on the cover");
}
if (isAcceptableSubtitle("蟹肉咖喱很有家常味", "曼谷隐藏泰餐", { dishes: ["Crab Meat Curry"] })) {
  /* level-5 info line is allowed */
} else {
  throw new Error("flat but accurate dish line should still pass");
}
if (isAcceptableSubtitle("绝绝子太好吃了", "曼谷隐藏泰餐")) {
  throw new Error("slang subtitle must fail");
}
if (inventsUnsupportedCoverClaim("这口蟹肉咖喱像家的味道", { dishes: ["Crab Meat Curry"] })) {
  /* expected: no homestyle evidence */
} else {
  throw new Error("homestyle claim needs evidence");
}
if (inventsUnsupportedCoverClaim("蟹肉咖喱像家的味道", { dishes: ["Crab Meat Curry"], diningNote: "味道很像家里做的" })) {
  throw new Error("homestyle claim with evidence must pass");
}

const repaired = layoutCoverOverlay("曼谷隐藏泰餐", "蒜炒虾仁滑蛋饭很有家常味", [], {
  dishes: ["Garlic Shrimp Egg Rice"],
  diningNote: "蒜炒虾仁滑蛋饭味道很像家里做的",
});
if (repaired.subtitle.includes("蒜炒虾仁滑蛋饭")) {
  throw new Error(`cover subtitle still has full dish name: ${repaired.subtitle}`);
}
console.log(`repaired dish cover: ${repaired.title} | ${repaired.subtitle}`);

if (sanitizeCoverAbsoluteLanguage("最爱的一家泰餐") !== "超爱的一家泰餐") {
  throw new Error("最爱 must become 超爱");
}
if (sanitizeCoverAbsoluteLanguage("我最爱这道") !== "我超爱这道") {
  throw new Error("我最爱这道 must become 我超爱这道");
}
if (sanitizeCoverAbsoluteLanguage("曼谷第一泰餐") !== "曼谷超爱泰餐") {
  throw new Error("曼谷第一泰餐 must become 曼谷超爱泰餐");
}
if (sanitizeCoverAbsoluteLanguage("没想到最喜欢这道") !== "没想到超爱这道") {
  throw new Error("没想到最喜欢这道 must become 没想到超爱这道");
}
if (sanitizeCoverAbsoluteLanguage("第一次来尝试Baan Ying") !== "第一次来尝试Baan Ying") {
  throw new Error("第一次 must stay");
}
if (sanitizeCoverAbsoluteLanguage("曼谷最近泰餐") !== "曼谷最近泰餐") {
  throw new Error("最近 must stay");
}
if (sanitizeCoverAbsoluteLanguage("必吃的泰餐") !== "很想再吃的泰餐") {
  throw new Error("必吃的泰餐 must become 很想再吃的泰餐");
}
const rewrittenCover = layoutCoverOverlay("曼谷最好吃泰餐", "最爱这道冬阴功", []);
if (/最(?!近|后|终)|第一(?!次|道)/.test(`${rewrittenCover.title}${rewrittenCover.subtitle}`)) {
  throw new Error(`cover still has ranking language: ${rewrittenCover.title} | ${rewrittenCover.subtitle}`);
}
console.log(`rewritten ranking cover: ${rewrittenCover.title} | ${rewrittenCover.subtitle}`);
