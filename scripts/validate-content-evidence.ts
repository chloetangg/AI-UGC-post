import { layoutCoverOverlay } from "../lib/cover/cover-title";
import { hasCoverTitleKeyword } from "../lib/cover/cover-rules";
import {
  ensureEvidenceLedCopy,
  extractExperienceFacts,
  isBannedDiscoveryFallback,
  isLowDiversityDiscoveryTitles,
  isWeakSeoCover,
} from "../lib/content-evidence";

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

console.log("content-evidence cases passed");
