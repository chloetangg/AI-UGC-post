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
import { buildEvidenceMap, ensureContentLock } from "../lib/content-lock";
import {
  availableContentFocuses,
  detectContentFocus,
  ensureGenerationVariation,
  firstSentencePattern,
  hasUnnaturalChinese,
  isCaptionTooSimilar,
  openingFamily,
  planGenerationVariation,
  storyHanCount,
  type GenerationMemory,
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
assert(!/带家人|两个人|一家三口|和朋友/.test(case5.titles.join("")), `case5 invented party: ${case5.titles.join(" / ")}`);
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
const thinHits = ["中文菜单", "服务", "支付宝", "空间", "很大", "正宗", "滑蛋"].filter((marker) =>
  thinCaption.caption.includes(marker),
);
assert(thinHits.length >= 2, `multi-select caption still thin: ${thinCaption.caption}`);
assert(thinHits.length <= 5, `multi-select still average-covered every point: ${thinCaption.caption}`);
assert(!/有中文菜单，餐厅面积很大，店员服务/.test(thinCaption.caption), `multi-select listed tags: ${thinCaption.caption}`);
assert(!/来曼谷当然要安排/.test(thinCaption.caption), `multi-select kept generic opener: ${thinCaption.caption}`);
assert(!hasUnnaturalChinese(thinCaption.caption), `multi-select unnatural: ${thinCaption.caption}`);
assert(Boolean(thinCaption.memory?.contentFocus), "first generate missing contentFocus memory");
console.log(`variation multi-select [${thinCaption.memory.contentFocus}]: ${thinCaption.caption}`);

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
  previousMemories: [planA.memory],
});
assert(planA.contentFocus !== planB.contentFocus, `consecutive plans reused focus ${planA.contentFocus}`);
assert(planA.openingStyle !== planB.openingStyle || planA.informationPriority.join(">") !== planB.informationPriority.join(">"), "consecutive plans kept the same opening and info order");
const rebuilt = ensureGenerationVariation({
  titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: previousLong,
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "中文菜单太方便",
  plan: planB,
  context: multiContext,
  previousCaption: previousLong,
  previousMemories: [planA.memory],
  variantIndex: 1,
});
assert(!isCaptionTooSimilar(rebuilt.caption, previousLong), `regenerate still too similar: ${rebuilt.caption}`);
assert(openingFamily(rebuilt.caption) !== openingFamily(previousLong), `regenerate kept opening family: ${rebuilt.caption}`);
assert(
  detectContentFocus(rebuilt.caption, extractExperienceFacts(multiContext)) !==
    detectContentFocus(previousLong, extractExperienceFacts(multiContext)) ||
    rebuilt.memory.contentFocus !== planA.contentFocus,
  `regenerate kept the same content focus: ${rebuilt.caption}`,
);
assert(
  Math.abs(storyHanCount(rebuilt.caption) - storyHanCount(previousLong)) >= 8,
  `length barely changed ${storyHanCount(previousLong)} → ${storyHanCount(rebuilt.caption)}: ${rebuilt.caption}`,
);
console.log(`variation regenerate [${rebuilt.memory.contentFocus}]: ${rebuilt.caption}`);

const consecutiveFocuses: string[] = [];
const consecutiveMemories: GenerationMemory[] = [];
let previousCaption = "";
for (let index = 0; index < 4; index += 1) {
  const plan = planGenerationVariation({
    context: multiContext,
    variantIndex: index,
    previousCaption,
    previousMemories: consecutiveMemories,
  });
  if (consecutiveMemories.length > 0) {
    assert(
      plan.contentFocus !== consecutiveMemories.at(-1)?.contentFocus,
      `generate ${index + 1} reused last contentFocus ${plan.contentFocus}`,
    );
  }
  const output = ensureGenerationVariation({
    titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
    caption: previousCaption || "来曼谷当然要安排一顿泰国菜。食物很好吃。",
    coverTitle: "曼谷泰餐味道正宗",
    coverSubtitle: "中文菜单太方便",
    plan,
    context: multiContext,
    previousCaption: previousCaption || undefined,
    previousMemories: consecutiveMemories.slice(),
    variantIndex: index,
  });
  consecutiveFocuses.push(plan.contentFocus);
  consecutiveMemories.push(output.memory);
  previousCaption = output.caption;
  console.log(`focus loop ${index + 1} [${plan.contentFocus} / ${plan.openingStyle}]: ${output.caption}`);
}
const available = availableContentFocuses(multiContext, extractExperienceFacts(multiContext));
assert(new Set(consecutiveFocuses.slice(0, Math.min(3, available.length))).size >= Math.min(3, available.length), `first 3 regenerates reused focuses: ${consecutiveFocuses.join(" → ")}`);

const baanYingContext = {
  diningNote: "第一次来，环境舒适。老板很帅。蒜炒虾仁Q弹。青咖喱牛肉辣度适中，椰香浓郁。可以使用支付宝。在购物商场里的Baan Ying。",
  enjoyMost: ["在购物商场里的泰餐连锁", "支付可以使用支付宝"],
  dishes: ["Garlic Shrimp", "Green Curry Beef"],
  recommendTo: ["蒜炒虾仁Q弹", "青咖喱牛肉辣度适中", "青咖喱牛肉椰香浓郁"],
  customerType: "Tourist",
  visitFrequency: "1st time",
};
const baanMemories: GenerationMemory[] = [];
const baanFocuses: string[] = [];
const baanCaptions: string[] = [];
let lastBaan = "";
for (let index = 0; index < 4; index += 1) {
  const plan = planGenerationVariation({
    context: baanYingContext,
    variantIndex: index,
    previousCaption: lastBaan,
    previousMemories: baanMemories,
  });
  const output = ensureGenerationVariation({
    titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
    caption: lastBaan || "这次第一次来到centralwOrld的Baan Ying，老板特别帅，让整个用餐过程很愉快。",
    coverTitle: "曼谷泰餐味道正宗",
    coverSubtitle: "中文菜单太方便",
    plan,
    context: baanYingContext,
    previousCaption: lastBaan || undefined,
    previousMemories: baanMemories.slice(),
    variantIndex: index,
  });
  if (baanFocuses.length > 0) {
    assert(plan.contentFocus !== baanFocuses.at(-1), `Baan Ying generate ${index + 1} reused focus ${plan.contentFocus}`);
    assert(!isCaptionTooSimilar(output.caption, lastBaan), `Baan Ying generate ${index + 1} too similar: ${output.caption}`);
    assert(
      firstSentencePattern(output.caption) !== firstSentencePattern(lastBaan),
      `Baan Ying generate ${index + 1} reused first-sentence pattern: ${output.caption}`,
    );
    assert(
      !(/这次最想推荐的是/.test(output.caption) && /这次最想推荐的是/.test(lastBaan)),
      `Baan Ying generate ${index + 1} reused 这次最想推荐的是: ${output.caption}`,
    );
  }
  baanFocuses.push(plan.contentFocus);
  baanMemories.push(output.memory);
  baanCaptions.push(output.caption);
  lastBaan = output.caption;
  console.log(`baan ying ${index + 1} [${plan.contentFocus}]: ${output.caption}`);
}
assert(new Set(baanFocuses).size >= 3, `Baan Ying focuses too repeated: ${baanFocuses.join(" → ")}`);
assert(
  baanCaptions.filter((caption) => /吃下来整体|整体来说|整体体验下来/.test(caption)).length <= 1,
  `too many summary endings: ${baanCaptions.join(" || ")}`,
);

const noParty = ensureGroundedHeadlineCopy({
  titles: ["两个人来曼谷吃泰餐", "和朋友一起吃真的很舒服", "一家三口来这里很方便"],
  coverTitle: "带家人来吃泰餐",
  coverSubtitle: "一个人来吃也很方便",
  context: {
    enjoyMost: ["食物味道正宗美味", "餐厅风格有满满的家庭式温馨氛围"],
    dishes: ["Scrambled Egg Rice", "Garlic Shrimp", "Crab Meat Curry", "Mango Sticky Rice"],
    mealAmount: 2000,
  },
});
assert(
  !/两个人|和朋友|一家三口|带家人|一个人来|一家人/.test(
    `${noParty.titles.join("")}${noParty.coverTitle}${noParty.coverSubtitle}`,
  ),
  `invented party size: ${noParty.titles.join(" / ")} | ${noParty.coverTitle} ${noParty.coverSubtitle}`,
);
const noPartyFacts = extractExperienceFacts({
  enjoyMost: ["食物味道正宗美味", "餐厅风格有满满的家庭式温馨氛围"],
  dishes: ["Scrambled Egg Rice"],
  mealAmount: 2000,
});
assert(
  !noPartyFacts.some((fact) => fact.id === "for-two" || fact.id === "family-friendly"),
  `party facts without evidence: ${noPartyFacts.map((fact) => fact.id).join(",")}`,
);

const twoParty = ensureGroundedHeadlineCopy({
  titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "这次来吃很舒服"],
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: { diningNote: "两个人来吃，味道很正宗" },
});
assert(
  extractExperienceFacts({ diningNote: "两个人来吃，味道很正宗" }).some((fact) => fact.id === "for-two"),
  "explicit 两个人 should create for-two",
);
console.log(`party two-person titles: ${twoParty.titles.join(" / ")}`);

const tomYumLockContext = {
  diningNote: "最喜欢河虾冬阴功汤，酸辣开胃，虾很大。芒果糯米饭也点了。",
  dishes: ["River Prawn Tom Yum", "Mango Sticky Rice"],
  recommendTo: ["酸辣开胃", "虾很大"],
};
const tomYumMap = buildEvidenceMap(tomYumLockContext);
assert(tomYumMap.primaryContent === "河虾冬阴功汤", `primary should be 河虾冬阴功汤, got ${tomYumMap.primaryContent}`);
const mismatched = ensureContentLock({
  titles: ["centralwOrld的芒果糯米饭值得一试！", "曼谷泰餐味道很正宗", "中文菜单点餐太方便"],
  caption: "点的几道里面，我比较喜欢菠萝炒饭。",
  coverTitle: "曼谷芒果糯米饭",
  coverSubtitle: "这口芒果糯米饭很香",
  context: tomYumLockContext,
});
assert(/河虾冬阴功汤|冬阴功/.test(mismatched.titles[0]), `title hero not locked: ${mismatched.titles[0]}`);
assert(/河虾冬阴功汤/.test(mismatched.caption), `caption missing primary: ${mismatched.caption}`);
assert(!/菠萝炒饭/.test(mismatched.caption), `caption kept unevidenced dish: ${mismatched.caption}`);
assert(!/芒果糯米饭/.test(mismatched.titles[0]), `title still isolated mango: ${mismatched.titles[0]}`);
assert(!/菠萝炒饭/.test(`${mismatched.titles.join("")}${mismatched.coverTitle}`), `isolated pineapple remains`);
const wording = ensureContentLock({
  titles: ["曼谷泰餐芒果糯米饭", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "芒果糯米饭很好吃，味道不错。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: { diningNote: "芒果糯米饭，粘度刚好，不会太甜，很合我口味。", dishes: ["Mango Sticky Rice"] },
});
assert(/粘度刚好|不会太甜|很合我口味/.test(wording.caption), `lost customer wording: ${wording.caption}`);
assert(!/上次这次来|与个人预期有所不同/.test(
  ensureContentLock({
    titles: ["曼谷泰餐味道很正宗", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
    caption: "上次这次来，果然没有与个人预期有所不同。",
    coverTitle: "曼谷泰餐味道正宗",
    coverSubtitle: "这顿吃下来很满足",
    context: tomYumLockContext,
  }).caption,
), "semantic conflict left in caption");
console.log(`content lock titles: ${mismatched.titles.join(" / ")}`);
console.log(`content lock caption: ${mismatched.caption}`);
console.log(`content lock wording: ${wording.caption}`);

const narrativeContext = {
  diningNote: "今天第一次来到centralwOrld。咖喱蟹肉份量很足，搭配米饭下饭。蒜炒虾仁蒜香足，蒜末酥脆。整体用餐体验很好。",
  dishes: ["Crab Meat Curry", "Garlic Shrimp", "Pineapple Fried Rice"],
  recommendTo: ["份量足", "搭配米饭下饭"],
};
const misplacedAttr = ensureContentLock({
  titles: ["曼谷泰餐咖喱蟹肉", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "咖喱蟹肉蒜香味很足，这个口味我比较喜欢。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: narrativeContext,
});
assert(!/咖喱蟹肉蒜香/.test(misplacedAttr.caption), `cross-dish attribute left: ${misplacedAttr.caption}`);
assert(/蒜炒虾仁/.test(misplacedAttr.caption) && /蒜香/.test(misplacedAttr.caption), `garlic attr not rebound: ${misplacedAttr.caption}`);
const splitDish = ensureContentLock({
  titles: ["曼谷泰餐咖喱蟹肉", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "咖喱蟹肉份量很足，搭配米饭很下饭。蒜炒虾仁蒜香很足。咖喱蟹肉我很喜欢。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: narrativeContext,
});
assert((splitDish.caption.match(/咖喱蟹肉/g) ?? []).length === 1, `same dish split/restated: ${splitDish.caption}`);
assert(/份量/.test(splitDish.caption), `lost curry portion: ${splitDish.caption}`);
const lateDish = ensureContentLock({
  titles: ["曼谷泰餐咖喱蟹肉", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "今天第一次来到centralwOrld逛街后适合休息。咖喱蟹肉份量很足，搭配米饭很下饭。整体用餐体验很好，下次还想来试试其他菜色。蒜炒虾仁蒜香味很足，这个口味我比较喜欢。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: narrativeContext,
});
const endingAt = lateDish.caption.search(/整体用餐|下次还/);
const shrimpAt = lateDish.caption.indexOf("蒜炒虾仁");
assert(shrimpAt >= 0 && endingAt >= 0 && shrimpAt < endingAt, `new dish after ending: ${lateDish.caption}`);
console.log(`narrative flow caption: ${misplacedAttr.caption}`);
console.log(`narrative merge caption: ${splitDish.caption}`);
console.log(`narrative ending caption: ${lateDish.caption}`);

const greenCurryContext = {
  diningNote: "蒜炒虾仁Q弹。青咖喱牛肉浓厚的椰香味，牛肉很软烂。",
  dishes: ["Garlic Shrimp", "Green Curry Beef"],
  recommendTo: ["蒜炒虾仁很Q弹", "青咖喱牛肉椰香味很足"],
};
const gluedCurry = ensureContentLock({
  titles: ["曼谷泰餐蒜炒虾仁", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "蒜炒虾仁Q弹，浓厚的椰香味，牛肉很软烂。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: greenCurryContext,
});
assert(!/蒜炒虾仁[^。]*椰香/.test(gluedCurry.caption), `coconut stuck on shrimp: ${gluedCurry.caption}`);
assert(!/蒜炒虾仁[^。]*软烂/.test(gluedCurry.caption), `tender beef stuck on shrimp: ${gluedCurry.caption}`);
assert(/青咖喱牛肉/.test(gluedCurry.caption) && /椰香/.test(gluedCurry.caption), `green curry lost coconut: ${gluedCurry.caption}`);
assert(/青咖喱牛肉/.test(gluedCurry.caption) && /软烂/.test(gluedCurry.caption), `green curry lost tender beef: ${gluedCurry.caption}`);
const misnamedCurry = ensureContentLock({
  titles: ["曼谷泰餐蒜炒虾仁", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "蒜炒虾仁浓厚的椰香味，牛肉很软烂。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: greenCurryContext,
});
assert(!/蒜炒虾仁[^。]*椰香/.test(misnamedCurry.caption), `renamed curry still on shrimp: ${misnamedCurry.caption}`);
assert(/青咖喱牛肉/.test(misnamedCurry.caption), `misnamed coconut not rebound: ${misnamedCurry.caption}`);
const restoreCurry = ensureContentLock({
  titles: ["曼谷泰餐蒜炒虾仁", "中文菜单点餐太方便", "环境够大吃饭也舒服"],
  caption: "点的几道里面，我比较喜欢蒜炒虾仁。",
  coverTitle: "曼谷泰餐味道正宗",
  coverSubtitle: "这顿吃下来很满足",
  context: baanYingContext,
});
assert(!/蒜炒虾仁[^。]*椰香/.test(restoreCurry.caption), `restore glued coconut onto shrimp: ${restoreCurry.caption}`);
if (/椰香/.test(restoreCurry.caption)) {
  assert(/青咖喱牛肉[^。]*椰香/.test(restoreCurry.caption), `coconut not on green curry: ${restoreCurry.caption}`);
}
console.log(`green curry split: ${gluedCurry.caption}`);
console.log(`green curry rebound: ${misnamedCurry.caption}`);
console.log(`green curry restore: ${restoreCurry.caption}`);

console.log("content-evidence cases passed");
