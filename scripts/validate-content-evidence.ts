import { layoutCoverOverlay } from "../lib/cover/cover-title";
import { hasCoverTitleKeyword } from "../lib/cover/cover-rules";
import {
  CANONICAL_CENTRALWORLD,
  copyMentionsExactCentralworld,
  ensureEvidenceLedCopy,
  ensureGroundedHeadlineCopy,
  extractExperienceFacts,
  isBannedDiscoveryFallback,
  isLowDiversityDiscoveryTitles,
  isWeakSeoCover,
} from "../lib/content-evidence";
import {
  ensureGenerationVariation,
  hasUnnaturalChinese,
  isCaptionTooSimilar,
  planGenerationVariation,
  storyHanCount,
} from "../lib/generation-variation";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function layersHit(titles: string[], caption: string, cover: string, markers: string[]) {
  const titleHit = titles.some((title) => markers.some((marker) => title.includes(marker)));
  const captionHit = markers.some((marker) => caption.includes(marker));
  const coverHit = markers.some((marker) => cover.includes(marker));
  return [titleHit, captionHit, coverHit].filter(Boolean).length;
}

const case1Context = {
  diningNote: "老板很帅，服务很好",
  dishes: ["Crab Meat Curry"],
  recommendTo: ["咖喱蟹肉味道很浓郁"],
  enjoyMost: ["店员服务热情周到"],
};

const case1 = ensureEvidenceLedCopy({
  titles: ["曼谷美食发现", "曼谷美食推荐", "曼谷泰餐推荐"],
  caption: "来曼谷当然要安排一顿泰国菜。咖喱蟹肉也不错。",
  coverTitle: "曼谷美食发现",
  coverSubtitle: "这几道菜还想再点",
  context: case1Context,
});

assert(!isBannedDiscoveryFallback(case1.coverTitle), `case1 cover still discovery: ${case1.coverTitle}`);
assert(!isWeakSeoCover(case1.coverTitle), `case1 cover is weak SEO: ${case1.coverTitle}`);
assert(hasCoverTitleKeyword(case1.coverTitle), `case1 cover missing keyword: ${case1.coverTitle}`);
assert(
  layersHit(case1.titles, case1.caption, `${case1.coverTitle}${case1.coverSubtitle}`, ["老板", "服务", "帅"]) >= 2,
  `case1 need boss/service in 2 layers: ${case1.titles.join(" / ")} | ${case1.caption} | ${case1.coverTitle} ${case1.coverSubtitle}`,
);
assert(!isLowDiversityDiscoveryTitles(case1.titles), `case1 titles still discovery: ${case1.titles.join(" / ")}`);
console.log(`case1 cover: ${case1.coverTitle} | ${case1.coverSubtitle}`);
console.log(`case1 titles: ${case1.titles.join(" / ")}`);

const overlay1 = layoutCoverOverlay("曼谷美食发现", "这几道菜还想再点", case1.titles, case1Context);
assert(!isBannedDiscoveryFallback(overlay1.title), `overlay1 still discovery: ${overlay1.title}`);
assert(/老板|帅|服务/.test(`${overlay1.title}${overlay1.subtitle}`), `overlay1 missing person/service: ${overlay1.title} | ${overlay1.subtitle}`);
console.log(`overlay1: ${overlay1.title} | ${overlay1.subtitle}`);

const case2Context = {
  diningNote: "逛完centralwOrld之后刚好来吃，店里很舒服，服务也很好。",
  visitFrequency: "1st time",
};
const overlay2 = layoutCoverOverlay("曼谷泰餐推荐", "这顿吃下来很满足", [], case2Context);
assert(!/曼谷美食发现|曼谷泰餐推荐|曼谷美食推荐/.test(overlay2.title), `case2 discovery fallback: ${overlay2.title}`);
assert(/逛|舒服|服务/.test(`${overlay2.title}${overlay2.subtitle}`), `case2 missing scene: ${overlay2.title} | ${overlay2.subtitle}`);
console.log(`case2 overlay: ${overlay2.title} | ${overlay2.subtitle}`);

const case3Context = { diningNote: "第一次来，原本只是想试试看，没想到服务很好。" };
const overlay3 = layoutCoverOverlay("曼谷泰餐推荐", "第一次来尝试Baan Ying", [], case3Context);
assert(!/曼谷泰餐推荐/.test(overlay3.title), `case3 still 推荐: ${overlay3.title}`);
assert(/服务|第一次/.test(`${overlay3.title}${overlay3.subtitle}`), `case3 missing first-visit/service: ${overlay3.title} | ${overlay3.subtitle}`);
console.log(`case3 overlay: ${overlay3.title} | ${overlay3.subtitle}`);

const case4Context = {
  diningNote: "没有特别的服务体验，主要是咖喱蟹肉很好吃。",
  dishes: ["Crab Meat Curry"],
};
const facts4 = extractExperienceFacts(case4Context);
assert(
  facts4.some((fact) => fact.kind === "food"),
  `case4 should be food-led, got ${facts4.map((item) => item.id).join(",")}`,
);
assert(
  !facts4.some((fact) => fact.id === "good-service"),
  `case4 should not extract good-service, got ${facts4.map((item) => item.id).join(",")}`,
);
const overlay4 = layoutCoverOverlay("曼谷美食发现", "这几道菜还想再点", [], case4Context);
assert(/咖喱/.test(`${overlay4.title}${overlay4.subtitle}`), `case4 missing dish: ${overlay4.title} | ${overlay4.subtitle}`);
assert(!isBannedDiscoveryFallback(overlay4.title), `case4 discovery fallback: ${overlay4.title}`);
console.log(`case4 overlay: ${overlay4.title} | ${overlay4.subtitle}`);

const case5Context = {
  diningNote: "服务很热情，中文菜单，环境很大，很适合家庭用餐",
  enjoyMost: ["有中文菜单", "餐厅面积很大", "店员服务热情周到"],
};
const case5 = ensureGroundedHeadlineCopy({
  titles: ["曼谷今天也太好吃了", "隐藏在曼谷的宝藏餐厅", "第一次来曼谷一定要吃"],
  coverTitle: "曼谷美食天花板",
  coverSubtitle: "泰国本地人才知道的美食",
  context: case5Context,
});
assert(
  copyMentionsExactCentralworld([...case5.titles, case5.coverTitle, case5.coverSubtitle]),
  `case5 missing exact centralwOrld: ${case5.titles.join(" / ")} | ${case5.coverTitle} ${case5.coverSubtitle}`,
);
assert(
  !/CentralWorld|centralworld|Central World|尚泰世界/.test(
    [...case5.titles, case5.coverTitle, case5.coverSubtitle].join(" ").split(CANONICAL_CENTRALWORLD).join(""),
  ),
  `case5 used a centralwOrld variant: ${case5.titles.join(" / ")}`,
);
assert(
  !/今天也太|隐藏宝藏|本地人才知道|一定要吃|美食天花板/.test(
    `${case5.titles.join("")}${case5.coverTitle}${case5.coverSubtitle}`,
  ),
  `case5 still generic: ${case5.titles.join(" / ")} | ${case5.coverTitle} ${case5.coverSubtitle}`,
);
assert(/中文菜单/.test(case5.titles.join("")), `case5 missing 中文菜单: ${case5.titles.join(" / ")}`);
assert(
  /够大|环境|家庭|面积/.test(case5.titles.join("")),
  `case5 missing size/family angle: ${case5.titles.join(" / ")}`,
);
assert(!/第一次来/.test(case5.titles.join("")), `case5 invented first-visit: ${case5.titles.join(" / ")}`);
assert(
  new Set(case5.titles.map((title) => title.replace(/🇹🇭|centralwOrld/g, "").slice(0, 6))).size >= 2,
  `case5 titles too similar: ${case5.titles.join(" / ")}`,
);
console.log(`case5 titles: ${case5.titles.join(" / ")}`);
console.log(`case5 cover: ${case5.coverTitle} | ${case5.coverSubtitle}`);

const case6 = ensureGroundedHeadlineCopy({
  titles: ["中文菜单点餐太方便", "这家服务很热情", "环境够大吃饭也舒服"],
  coverTitle: "曼谷泰餐服务好",
  coverSubtitle: "中文菜单太方便",
  context: case5Context,
});
assert(
  copyMentionsExactCentralworld([...case6.titles, case6.coverTitle, case6.coverSubtitle]),
  `case6 missing exact centralwOrld after grounded titles: ${case6.titles.join(" / ")}`,
);
const case6Hits = [...case6.titles, case6.coverTitle, case6.coverSubtitle].filter((line) =>
  line.includes(CANONICAL_CENTRALWORLD),
).length;
assert(case6Hits >= 1 && case6Hits <= 2, `case6 stuffed centralwOrld (${case6Hits}): ${case6.titles.join(" / ")}`);
console.log(`case6 titles: ${case6.titles.join(" / ")}`);

const multiContext = {
  enjoyMost: ["有中文菜单", "餐厅面积很大", "店员服务热情周到", "食物味道正宗美味", "支付可以使用支付宝"],
  diningNote: "滑蛋饭很好吃",
  dishes: ["Scrambled Egg Rice"],
  customerType: "Tourist",
  visitFrequency: "1st time",
};

const thinCaption = ensureGenerationVariation({
  titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "来曼谷当然要安排一顿泰国菜。食物很好吃。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "中文菜单太方便",
  plan: planGenerationVariation({ context: multiContext, variantIndex: 1 }),
  context: multiContext,
  variantIndex: 1,
});
assert(
  /中文菜单/.test(thinCaption.caption) && /服务|热情/.test(thinCaption.caption) && /支付宝|空间|很大/.test(thinCaption.caption),
  `multi-select caption still thin: ${thinCaption.caption}`,
);
assert(!/有中文菜单，餐厅面积很大，店员服务/.test(thinCaption.caption), `multi-select listed tags: ${thinCaption.caption}`);
assert(!hasUnnaturalChinese(thinCaption.caption), `multi-select unnatural: ${thinCaption.caption}`);
console.log(`variation multi-select: ${thinCaption.caption}`);

const polarity = ensureGenerationVariation({
  titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "食物味道正宗美味，但味道还有提升空间。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "中文菜单太方便",
  plan: planGenerationVariation({ context: { enjoyMost: ["食物味道正宗美味"] }, variantIndex: 0 }),
  context: { enjoyMost: ["食物味道正宗美味"] },
  variantIndex: 0,
});
assert(!/提升空间/.test(polarity.caption), `positive taste flipped: ${polarity.caption}`);

const stacked = ensureGenerationVariation({
  titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "就是食材新鲜度感觉提升空间。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "中文菜单太方便",
  plan: planGenerationVariation({
    context: { diningNote: "食材新鲜度感觉提升空间" },
    variantIndex: 2,
  }),
  context: { diningNote: "食材新鲜度感觉提升空间" },
  variantIndex: 2,
});
assert(!/就是食材新鲜度感觉提升空间/.test(stacked.caption), `stacked keywords remain: ${stacked.caption}`);
assert(/新鲜/.test(stacked.caption), `freshness note dropped: ${stacked.caption}`);
assert(!/非常新鲜/.test(stacked.caption), `downgrade flipped to praise: ${stacked.caption}`);
console.log(`variation stacked: ${stacked.caption}`);

const previousLong =
  "第一次来吃其实还挺方便的。店里有中文菜单，点菜不会有太大压力。店里的空间比想象中大很多，坐下来吃饭不会觉得挤。店员服务很热情，整个用餐过程都让人觉得很舒服。食物整体味道很正宗，吃起来就是很熟悉的泰式风味。对中国游客来说，支付宝也可以使用，付款的时候会方便很多。";
const planA = planGenerationVariation({ context: multiContext, variantIndex: 0, previousCaption: "" });
const planB = planGenerationVariation({
  context: multiContext,
  variantIndex: 1,
  previousCaption: previousLong,
});
assert(planA.structureId !== planB.structureId || planA.lengthBand !== planB.lengthBand || planA.focusId !== planB.focusId, "consecutive plans did not rotate");
const rebuilt = ensureGenerationVariation({
  titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: previousLong,
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "中文菜单太方便",
  plan: planB,
  context: multiContext,
  previousCaption: previousLong,
  variantIndex: 1,
});
assert(!isCaptionTooSimilar(rebuilt.caption, previousLong), `regenerate still too similar: ${rebuilt.caption}`);
assert(
  Math.abs(storyHanCount(rebuilt.caption) - storyHanCount(previousLong)) >= 10,
  `length barely changed ${storyHanCount(previousLong)} → ${storyHanCount(rebuilt.caption)}: ${rebuilt.caption}`,
);
console.log(`variation regenerate: ${rebuilt.caption}`);

console.log("content-evidence cases passed");
