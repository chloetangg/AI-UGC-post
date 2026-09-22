import { collectFullDishNames, coverDishShortName, chineseFullDishName, OFFICIAL_COVER_DISHES } from "@/lib/cover/dish-names";
import type { CoverTitleContext } from "@/lib/cover/cover-rules";
import type { RecommendedDish } from "@/types/content";
import { ensureNarrativeFlow, ownerOfPhrase } from "@/lib/narrative-flow";
import { isUnnaturalHeadline, naturalCoverFallback } from "@/lib/cover/cover-natural";

export type EvidenceMap = {
  strongestExperience: string;
  favoriteDish: string;
  recommendedDish: string;
  recommendationReason: string;
  enjoyedMost: string[];
  specificObservations: string[];
  atmosphere: string;
  service: string;
  convenience: string;
  location: string;
  visitStatus: string;
  customerWords: string[];
  primaryContent: string;
  supportingContent: string[];
  primaryKind: "dish" | "experience" | "scene";
};

const TIER1 =
  /很合我口味|吃完还想再点|很?Q弹|蒜香(味)?很足|不会太甜|粘度刚好|老板很帅|很有记忆点|虾很大|酸辣开胃|椰香浓郁|辣度适中|口感很嫩/;

const FORMAL =
  /与个人预期有所不同|与预期一致|符合个人预期|带来良好体验|提供舒适的用餐体验|整体而言|值得一提的是|不得不说/;

const SEMANTIC_FIXES: Array<[RegExp, string]> = [
  [/上次这次来/g, "这次来"],
  [/这次上次来/g, "这次来"],
  [/第一次又来/g, "第一次来"],
  [/第一次再次来到/g, "第一次来尝试"],
  [/果然没有与个人预期有所不同/g, "这次点的几道菜都挺合口味"],
  [/没有与个人预期有所不同/g, "都挺合口味"],
  [/与个人预期有所不同/g, "跟我想的不太一样"],
  [/符合个人预期|与预期一致/g, "挺合口味"],
  [/带来良好体验|提供舒适的用餐体验/g, "吃着比较舒服"],
  [/整体而言，?/g, ""],
  [/值得一提的是/g, ""],
  [/不得不说，?/g, ""],
];

function noteText(context: CoverTitleContext) {
  return context.diningNote?.trim() ?? "";
}

function selectedDishes(context: CoverTitleContext) {
  return (context.dishes ?? [])
    .filter((item) => item && item !== "Others")
    .map((item) => chineseFullDishName(item as RecommendedDish) || item)
    .filter(Boolean);
}

function dishTerms(full: string) {
  const official = OFFICIAL_COVER_DISHES.find((item) => item.full === full);
  return [full, official?.cover, ...(official?.aliases ?? [])].filter((item): item is string => Boolean(item));
}

function textMentionsDish(text: string, full: string) {
  return dishTerms(full).some((term) => term.length >= 2 && text.includes(term));
}

function dishesInText(text: string) {
  return collectFullDishNames({ sourceTexts: [text] });
}

function scoreDish(full: string, context: CoverTitleContext) {
  const note = noteText(context);
  const reasons = (context.recommendTo ?? []).join(" ");
  const enjoy = (context.enjoyMost ?? []).join(" ");
  let score = 0;
  if (textMentionsDish(note, full)) score += 4;
  if (/最喜欢|最难忘|推荐/.test(note) && textMentionsDish(note, full)) score += 4;
  if (TIER1.test(note) && textMentionsDish(note, full)) score += 3;
  if (selectedDishes(context)[0] === full) score += 3;
  if (selectedDishes(context).includes(full)) score += 2;
  if (textMentionsDish(reasons, full) || (reasons && selectedDishes(context).includes(full))) score += 2;
  if (/食物味道正宗美味|店里菜品选择丰富/.test(enjoy)) score += 1;
  return score;
}

function extractCustomerWords(context: CoverTitleContext) {
  const spoken = `${noteText(context)} ${(context.recommendTo ?? []).join(" ")}`;
  const hits = spoken.match(
    new RegExp(TIER1.source, "g"),
  ) ?? [];
  return [...new Set(hits)];
}

export function buildEvidenceMap(context: CoverTitleContext = {}): EvidenceMap {
  const note = noteText(context);
  const enjoy = (context.enjoyMost ?? []).filter((item) => item && item !== "其他");
  const reasons = (context.recommendTo ?? []).filter((item) => item && item !== "其他");
  const dishes = selectedDishes(context);
  const ranked = [...dishes].sort((a, b) => scoreDish(b, context) - scoreDish(a, context));
  const favoriteDish = ranked.find((dish) => /最喜欢|最难忘/.test(note) && textMentionsDish(note, dish)) || ranked[0] || "";
  const recommendedDish = dishes[0] || "";
  const customerWords = extractCustomerWords(context);
  const specificObservations = [...customerWords, ...reasons.filter((item) => TIER1.test(item) || item.length >= 4)];
  const atmosphere = enjoy.find((item) => /面积|温馨|翻新|环境/.test(item)) || (/舒服|放松|温馨|翻新/.test(note) ? "环境舒适" : "");
  const service = enjoy.find((item) => /服务|中文菜单/.test(item)) || (/服务|老板/.test(note) ? "服务或老板" : "");
  const convenience = enjoy.find((item) => /支付宝|商场/.test(item)) || (/支付宝|商场/.test(note) ? "用餐方便" : "");
  const location = /centralwOrld|商场/.test(`${note}${enjoy.join("")}`) ? "centralwOrld" : "";
  const visitStatus = /1st time/i.test(context.visitFrequency ?? "") || /第一次/.test(note) ? "first-visit" : context.visitFrequency || "";
  const strongestExperience = customerWords[0] || favoriteDish || atmosphere || service || convenience || "";
  const dishPrimary = ranked[0] && scoreDish(ranked[0], context) > 0 ? ranked[0] : "";
  const experiencePrimary = /老板/.test(note) ? "老板很帅" : atmosphere || service;
  const primaryContent = dishPrimary || experiencePrimary || strongestExperience;
  const supportingContent = [...ranked.slice(1, 3), ...specificObservations, atmosphere, service, convenience].filter(
    (item) => item && item !== primaryContent,
  );
  return {
    strongestExperience,
    favoriteDish,
    recommendedDish,
    recommendationReason: reasons[0] || "",
    enjoyedMost: enjoy,
    specificObservations: [...new Set(specificObservations)],
    atmosphere,
    service,
    convenience,
    location,
    visitStatus,
    customerWords,
    primaryContent,
    supportingContent: [...new Set(supportingContent)].slice(0, 5),
    primaryKind: dishPrimary ? "dish" : convenience && !experiencePrimary ? "scene" : "experience",
  };
}

export function formatContentLockRules(map: EvidenceMap) {
  return `CONTENT EVIDENCE & LOCK — additive. Title, caption, and cover share ONE Evidence Map. Do not interpret the input separately.

Generation order: User Input → Evidence Extraction → Content Priority → Primary Content → Caption → Titles → Cover → Cross-Output Validation.
Do NOT generate titles, caption, and cover as independent readings of the form.

THIS ROUND EVIDENCE MAP
strongestExperience: ${map.strongestExperience || "none"}
favoriteDish: ${map.favoriteDish || "none"}
recommendedDish: ${map.recommendedDish || "none"}
recommendationReason: ${map.recommendationReason || "none"}
enjoyedMost: ${map.enjoyedMost.join(" / ") || "none"}
specificObservations: ${map.specificObservations.join(" / ") || "none"}
atmosphere: ${map.atmosphere || "none"}
service: ${map.service || "none"}
convenience: ${map.convenience || "none"}
location: ${map.location || "none"}
visitStatus: ${map.visitStatus || "none"}
customerWords (Tier 1, keep the core meaning): ${map.customerWords.join(" / ") || "none"}

CONTENT LOCK
Primary Content: ${map.primaryContent || "none"}
Supporting Content: ${map.supportingContent.join(" / ") || "none"}

Priority: diningExperienceNote → explicit like/dislike/most memorable → favoriteDish → recommendedDish → recommendationReason → enjoy-most → tourist/local/visit/scene → brand/KSP/SEO.
Brand / KSP / SEO must never override a real customer experience.

ATTRIBUTE OWNERSHIP: bind each taste/texture/reason to the dish that owns it.
椰香 / 软烂的牛肉 / 辣度适中 → 青咖喱牛肉. 蒜香 / Q弹 → 蒜炒虾仁.
Never attach another dish's words to the primary dish just to use them.

Once locked, titles + caption + cover may only use Primary Content + Supporting Content.
Do not pick a different hero dish for the title or cover because it is shorter, more SEO-friendly, or looks better on a cover.
If Primary Content is a dish, at least one title and the caption must support that dish. Cover may name it only if the caption also does.
An isolated dish (mentioned but not the focus) cannot become the title/cover hero.

CUSTOMER WORDING: keep Tier 1 meaning. 
GOOD: 芒果糯米饭粘度刚好，也不会太甜，刚好是我喜欢的口味。
BAD: 芒果糯米饭很好吃，味道不错。
GOOD: 蒜炒虾仁蒜香味很足，虾仁Q弹。
BAD: 这道菜味道很丰富，很有层次。
Tier 2 facts (中文菜单 / 面积 / 支付宝 / 翻新) may be rewritten. Tier 3 brand/SEO cannot cover Tier 1.

No invented logic bridges: 逛街 / 走累了 / 下次还会来 / 带家人 unless the customer wrote them.
No formal translation-speak: 与个人预期有所不同 / 符合个人预期 / 带来良好体验 / 提供舒适的用餐体验.
No 上次这次来 / 第一次又来 / Title says A while caption's hero is B.

Final check: Title ↔ input, Title ↔ Caption, Cover ↔ Caption, shared Primary Content, customer wording kept, no invented facts, not a questionnaire dump or synonym rewrite.`;
}

export function neutralizeSemanticConflicts(text: string, context: CoverTitleContext = {}) {
  let next = text;
  for (const [pattern, replacement] of SEMANTIC_FIXES) next = next.replace(pattern, replacement);
  if (context.visitFrequency === "Not first time") {
    next = next.replace(/第一次来尝试Baan Ying/g, "这次来Baan Ying").replace(/第一次来/g, "这次来");
  }
  if (context.visitFrequency === "1st time" && !/经常|每次|又来/.test(context.diningNote ?? "")) {
    next = next.replace(/每次来/g, "这次来").replace(/又来了/g, "这次来");
  }
  return next.replace(/\s{2,}/g, " ").replace(/，{2,}/g, "，").trim();
}

function replaceDishName(text: string, from: string, to: string, forCover = false) {
  const replacement = forCover ? coverDishShortName(to) : to;
  let next = text;
  for (const term of dishTerms(from).sort((a, b) => b.length - a.length)) {
    if (term.length >= 2 && next.includes(term)) next = next.split(term).join(replacement);
  }
  return next;
}

function dishLineFromEvidence(map: EvidenceMap, context: CoverTitleContext) {
  const dish = map.primaryKind === "dish" ? map.primaryContent : map.favoriteDish;
  if (!dish) return "";
  const words = map.customerWords.filter((word) => !/老板/.test(word) && ownerOfPhrase(word, context) === dish);
  if (words.length > 0) return `${dish}${words[0]}，这个口味我比较喜欢。`;
  const reason = (context.recommendTo ?? []).find((item) => ownerOfPhrase(item, context) === dish || item.includes(dish));
  if (reason) return `${dish}${reason.replace(dish, "")}。`;
  if (map.recommendationReason && (map.recommendationReason.includes(dish) || ownerOfPhrase(map.recommendationReason, context) === dish)) {
    return `${dish}${map.recommendationReason.replace(dish, "")}。`;
  }
  return `${dish}这次还蛮喜欢的。`;
}

function alignLineToPrimary(line: string, map: EvidenceMap, captionDishes: string[], forCover = false) {
  const named = dishesInText(line);
  const captionHero = captionDishes.includes(map.primaryContent) ? map.primaryContent : captionDishes[0] || "";
  const target = map.primaryKind === "dish" ? map.primaryContent : captionHero || map.primaryContent;
  const isolated = named.filter((dish) => {
    if (!target) return false;
    if (dish === target) return false;
    if (captionDishes.includes(dish) && named.includes(target)) return false;
    if (map.primaryKind === "dish" && dish !== map.primaryContent && (named.length === 1 || !captionDishes.includes(dish))) {
      return true;
    }
    return !captionDishes.includes(dish);
  });
  if (isolated.length === 0 || !target) return neutralizeSemanticConflicts(line);
  let next = line;
  for (const dish of isolated) next = replaceDishName(next, dish, target, forCover);
  return neutralizeSemanticConflicts(next);
}

function restoreCustomerWords(caption: string, map: EvidenceMap, context: CoverTitleContext) {
  let next = caption;
  if (FORMAL.test(next)) next = next.replace(FORMAL, "挺合口味");
  const missing = map.customerWords.filter((word) => {
    if (next.includes(word)) return false;
    const core = word.replace(/^很/, "");
    return !(core !== word && next.includes(core));
  });
  if (missing.length === 0) return next;
  const noteDishes = dishesInText(noteText(context));
  const grouped = new Map<string, string[]>();
  for (const word of missing) {
    const owner = ownerOfPhrase(word, context) || (noteDishes.length === 1 ? noteDishes[0] : "");
    if (!owner || /老板/.test(word)) continue;
    const core = word.replace(/^很/, "");
    const existing = grouped.get(owner) ?? [];
    if (existing.some((item) => item.includes(core) || core.includes(item.replace(/^很/, "")))) continue;
    grouped.set(owner, [...existing, word]);
  }
  for (const [dish, words] of grouped) {
    const restored = `${dish}${words.join("，")}，这个口味我比较喜欢。`;
    if (/很好吃|味道不错|味道很丰富|很有层次|整体体验/.test(next) && next.includes(dish)) {
      next = next.replace(/[^。！？!?]*很好吃[^。！？!?]*[。！？!?]?|[^。！？!?]*味道不错[^。！？!?]*[。！？!?]?/, restored);
      continue;
    }
    if (next.includes(dish)) {
      next = next.replace(new RegExp(`(${dish.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^。！？!?]*)([。！？!?])`), `$1，${words.join("，")}$2`);
      continue;
    }
    const parts = next.split(/(?<=[。！？!?])/).map((part) => part.trim()).filter(Boolean);
    const endingAt = parts.findIndex((part) => /整体用餐|下次还|刚好在centralwOrld/.test(part) && !part.includes(dish));
    if (endingAt >= 0) parts.splice(endingAt, 0, restored);
    else parts.push(restored);
    next = parts.join("");
  }
  return next;
}

export function ensureContentLock(input: {
  titles: [string, string, string];
  caption: string;
  coverTitle: string;
  coverSubtitle: string;
  context?: CoverTitleContext;
}) {
  const context = input.context ?? {};
  const map = buildEvidenceMap(context);
  let caption = restoreCustomerWords(neutralizeSemanticConflicts(input.caption, context), map, context);
  const evidencedDishes = new Set([...selectedDishes(context), ...dishesInText(noteText(context))]);
  caption = caption
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const named = dishesInText(part);
      if (named.length === 0) return true;
      return named.some((dish) => evidencedDishes.has(dish));
    })
    .join("");
  let captionDishes = dishesInText(caption);
  if (map.primaryKind === "dish" && map.primaryContent && !captionDishes.includes(map.primaryContent)) {
    const extra = dishLineFromEvidence(map, context);
    if (extra) caption = `${extra}${caption}`;
    captionDishes = dishesInText(caption);
  }
  caption = ensureNarrativeFlow(caption, context, map);
  captionDishes = dishesInText(caption);
  const titles = input.titles.map((title, index) => {
    const aligned = alignLineToPrimary(neutralizeSemanticConflicts(title, context), map, captionDishes);
    return isUnnaturalHeadline(aligned) ? naturalCoverFallback(context, index) : aligned;
  }) as [string, string, string];
  let coverTitle = alignLineToPrimary(neutralizeSemanticConflicts(input.coverTitle, context), map, captionDishes, true);
  if (isUnnaturalHeadline(coverTitle)) coverTitle = naturalCoverFallback(context);
  const coverSubtitle = alignLineToPrimary(
    neutralizeSemanticConflicts(input.coverSubtitle, context),
    map,
    captionDishes,
    true,
  );
  return { titles, caption, coverTitle, coverSubtitle, map };
}
