import { chineseFullDishName, collectFullDishNames, OFFICIAL_COVER_DISHES } from "@/lib/cover/dish-names";
import type { CoverTitleContext } from "@/lib/cover/cover-rules";
import { DISH_RECOMMENDATION_REASONS } from "@/lib/recommendation-reasons";
import type { RecommendedDish } from "@/types/content";
import type { EvidenceMap } from "@/lib/content-lock";

export type FactGroup = {
  id: "scene" | "experience" | "primary-dish" | "secondary-dish" | "other-dish" | "opinion";
  label: string;
  items: string[];
};

const UNIQUE_ATTRS: Array<{ marker: RegExp; label: string; dishes: string[] }> = [
  { marker: /蒜香|蒜末|蒜沫/, label: "蒜香", dishes: ["蒜炒虾仁"] },
  { marker: /Q弹/, label: "Q弹", dishes: ["蒜炒虾仁"] },
  { marker: /粘度|不会太甜/, label: "粘度/甜度", dishes: ["芒果糯米饭"] },
  { marker: /椰香|椰奶/, label: "椰香", dishes: ["青咖喱牛肉"] },
  { marker: /软烂|牛肉很软|牛肉软/, label: "软烂", dishes: ["青咖喱牛肉"] },
  { marker: /辣度(适中|后劲)/, label: "辣度", dishes: ["青咖喱牛肉"] },
  { marker: /酸辣开胃/, label: "酸辣开胃", dishes: ["河虾冬阴功汤"] },
  { marker: /奶香/, label: "奶香", dishes: ["河虾冬阴功汤"] },
  { marker: /虾很大/, label: "虾很大", dishes: ["河虾冬阴功汤"] },
  { marker: /锅气/, label: "锅气", dishes: ["菠萝炒饭"] },
  { marker: /刺少/, label: "刺少", dishes: ["青柠蒸鲈鱼"] },
  { marker: /虾酱/, label: "虾酱", dishes: ["炒空心菜"] },
];

const ENDING =
  /整体用餐|吃下来整体|下次还|值得推荐|大家可以去|喜欢泰餐的|刚好在centralwOrld|这个口味我比较喜欢$/;
const WEAK_RESTATE = /我很喜欢|这次比较喜欢|还蛮喜欢|比较有记忆点|很好吃/;

function selectedDishes(context: CoverTitleContext) {
  return (context.dishes ?? [])
    .filter((item) => item && item !== "Others")
    .map((item) => chineseFullDishName(item as RecommendedDish) || item)
    .filter(Boolean);
}

function dishesInText(text: string) {
  return collectFullDishNames({ sourceTexts: [text] });
}

function splitSentences(caption: string) {
  return caption
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinSentences(sentences: string[]) {
  return sentences
    .map((item) => (/[。！？!?]$/.test(item) ? item : `${item}。`))
    .join("");
}

function dishTerms(full: string) {
  const official = OFFICIAL_COVER_DISHES.find((item) => item.full === full);
  return [full, official?.cover, ...(official?.aliases ?? [])].filter((item): item is string => Boolean(item));
}

function resolveAttrDish(item: (typeof UNIQUE_ATTRS)[number], context: CoverTitleContext) {
  const selected = selectedDishes(context).filter((dish) => item.dishes.includes(dish));
  return selected[0] || item.dishes[0];
}

function evidencedDish(dish: string, context: CoverTitleContext) {
  return selectedDishes(context).includes(dish) || dishesInText(context.diningNote ?? "").includes(dish);
}

export function ownerOfPhrase(text: string, context: CoverTitleContext = {}) {
  const hay = text.trim();
  if (!hay) return "";
  for (const item of UNIQUE_ATTRS) {
    if (!item.marker.test(hay)) continue;
    return resolveAttrDish(item, context);
  }
  const reasonHits: string[] = [];
  for (const [id, reasons] of Object.entries(DISH_RECOMMENDATION_REASONS)) {
    const full = chineseFullDishName(id);
    for (const reason of reasons) {
      const attr = reason.replace(full, "");
      const matched =
        hay.includes(reason) ||
        ((context.recommendTo ?? []).includes(reason) && hay.includes(attr)) ||
        (attr.length >= 4 && hay.includes(attr));
      if (matched) reasonHits.push(full);
    }
  }
  if ([...new Set(reasonHits)].length === 1) return reasonHits[0];
  const named = dishesInText(hay);
  if (named.length === 1) return named[0];
  const clauses = `${context.diningNote ?? ""}\n${(context.recommendTo ?? []).join("，")}`.split(/[。！？!?，、；;\n]/);
  for (const clause of clauses) {
    if (!clause.includes(hay) && !hay.split(/[，、]/).some((part) => part && clause.includes(part))) continue;
    const nearby = dishesInText(clause);
    if (nearby.length === 1) return nearby[0];
  }
  return "";
}

export function buildNarrativeGroups(context: CoverTitleContext = {}, map: EvidenceMap): FactGroup[] {
  const note = context.diningNote?.trim() ?? "";
  const enjoy = (context.enjoyMost ?? []).filter((item) => item && item !== "其他");
  const reasons = (context.recommendTo ?? []).filter((item) => item && item !== "其他");
  const dishes = selectedDishes(context);
  const primary = map.primaryKind === "dish" ? map.primaryContent : dishes[0] || "";
  const secondary = dishes.filter((dish) => dish !== primary);
  const dishReasons = (dish: string) =>
    reasons.filter((reason) => reason.includes(dish) || dishTerms(dish).some((term) => reason.includes(term)));
  const wordsForDish = (dish: string) =>
    map.customerWords.filter((word) => !/老板/.test(word) && ownerOfPhrase(word, context) === dish);
  const groups: FactGroup[] = [
    {
      id: "scene",
      label: "Experience / Scene",
      items: [
        /第一次/.test(note) || /1st time/i.test(context.visitFrequency ?? "") ? "第一次来" : "",
        /centralwOrld|商场|逛/.test(`${note}${enjoy.join("")}`) ? "商场/centralwOrld" : "",
        enjoy.find((item) => /温馨|翻新|面积/.test(item)) || (/舒服|温馨/.test(note) ? "氛围" : ""),
      ].filter(Boolean),
    },
    {
      id: "primary-dish",
      label: `Primary Dish ${primary}`,
      items: [primary, ...dishReasons(primary), ...wordsForDish(primary)].filter(Boolean),
    },
    {
      id: "secondary-dish",
      label: `Secondary Dish ${secondary[0] || ""}`,
      items: secondary[0] ? [secondary[0], ...dishReasons(secondary[0]), ...wordsForDish(secondary[0])] : [],
    },
    {
      id: "other-dish",
      label: "Other Dish",
      items: secondary.slice(1).flatMap((dish) => [dish, ...dishReasons(dish), ...wordsForDish(dish)]),
    },
    {
      id: "opinion",
      label: "Overall Opinion",
      items: [/老板/.test(note) ? "老板很帅" : "", enjoy.find((item) => /服务|支付宝|中文菜单/.test(item)) || ""].filter(Boolean),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

export function formatNarrativeFlowRules(context: CoverTitleContext = {}, map: EvidenceMap) {
  return `${formatNarrativeFlowStaticRules()}

${formatNarrativeFlowInstance(context, map)}`;
}

export function formatNarrativeFlowStaticRules() {
  return `NARRATIVE FLOW & ATTRIBUTE CONSISTENCY — additive.

Before writing the caption, decide this order and use each fact ONCE, in the best slot:
Opening scene → arriving → what was ordered → how it tasted and who liked it → service or room → overall feeling.

This is one meal, not a checklist of dish, comment, restaurant, service, and place. Do NOT stitch answers in form order. Do NOT finish the food and then add the restaurant name or the mall. Do NOT finish dish A, go to dish B, then come back to describe A. If the place is already in the opening, do not say it again.

DISH CONTINUITY — the first time a dish appears, finish 点了什么 → 怎么样 → 具体感受 in that same stretch, then move on.
Shape: 菜品 → 它的口味/口感/评价 → 下一道菜.
BAD: 这次一定要体验下Baan Ying的芒果糯米饭。接着点了咖喱蟹肉，味道浓郁。菠萝炒饭的配料也很足。芒果特别新鲜，搭配糯米口感完美。
GOOD: 这次一定要体验下Baan Ying的芒果糯米饭，芒果特别新鲜，搭配糯米口感刚刚好。接着点了咖喱蟹肉，味道浓郁，吃起来很满足。菠萝炒饭的配料也很足。
If one dish has several notes (很好吃 / 芒果很新鲜 / 甜而不腻 / 糯米口感很好), merge them beside the dish name. Do not save 芒果很新鲜 for after the other dishes.
Order the dishes, then walk forward only. After leaving a dish, do not jump back to add its taste, texture, freshness, or liking.
Do not add a later supplement just to use every input. Drop a repeated point. Do not change the customer's evaluation.
The only exception is an explicit look-back the customer wrote, such as 吃到后面又觉得还是第一道更好. Otherwise the caption moves in one direction.
Before writing, group each dish's name, taste, texture, freshness, liking, and other notes. After writing, check that each dish's main description sits next to its first mention. If not, move that description back. Do not print this grouping.

ATTRIBUTE OWNERSHIP is strict. A taste/texture/reason belongs to one dish only.
Never write 咖喱蟹肉蒜香味很足 if 蒜香 belongs to 蒜炒虾仁.
Never write 蒜炒虾仁浓厚的椰香味 / 软烂的牛肉 — those belong to 青咖喱牛肉.
${UNIQUE_ATTRS.map((item) => `${item.dishes[0]} ← ${item.label}`).join("\n")}
After writing, check Dish → Attribute / Reason / Opinion / Experience. Fix cross-dish mixups. Do not dump every customer word onto the primary dish.

Do not restate a finished dish unless the new sentence adds a real unused customer fact. Delete the restatement.

After Ending = true, do not open a new dish review. Move that sentence into the earlier dish block, or delete it.
If the evidence says 最后 / 最后点了 / 最后吃了 / 收尾 / 作为结尾 / 甜点收尾 / 吃完刚好 / 完美结束, that dish or moment stays in the second half. Never introduce a new dish after a 收尾 sentence.
Several dishes are not equal: one hero dish, then a shorter supporting dish, then the closing dish if there is one. Do not give every dish the same 很好吃 sentence.
Natural flow > covering every answer. Keep explicit negatives and clear attitudes.

Read-through test: each sentence should answer the last; same dish not split; no coming back; attributes on the right dish; last two sentences end, they do not start a new thread.`;
}

export function formatNarrativeFlowInstance(context: CoverTitleContext = {}, map: EvidenceMap) {
  const groups = buildNarrativeGroups(context, map);
  const groupBlock = groups
    .map((group, index) => `GROUP ${index + 1} — ${group.label}\n${group.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
  return `THIS ROUND FACT GROUPS (re-order into a natural story; do not dump every group):
${groupBlock || "none"}`;
}

function renderDishClauses(dish: string, clauses: string[]) {
  const text = clauses.join("，").replace(/^[，、的\s]+/, "").replace(/[，、\s]+$/, "");
  if (!text) return "";
  if (!dish) return text;
  let cleaned = text;
  for (const named of dishesInText(cleaned)) {
    if (named !== dish) cleaned = cleaned.split(named).join("");
  }
  cleaned = cleaned.replace(/^[，、的\s]+/, "").replace(/[，、\s]+$/, "");
  if (!cleaned) return "";
  return dishesInText(cleaned).includes(dish) ? cleaned : `${dish}${cleaned}`;
}

function sentenceNeedsAttrSplit(sentence: string, context: CoverTitleContext) {
  const named = dishesInText(sentence);
  const owners = UNIQUE_ATTRS.filter((item) => item.marker.test(sentence))
    .map((item) => resolveAttrDish(item, context))
    .filter((dish) => evidencedDish(dish, context));
  if (owners.length === 0) return false;
  return owners.some((dish) => !named.includes(dish));
}

function fixCrossDishAttributes(sentence: string, context: CoverTitleContext) {
  if (!sentenceNeedsAttrSplit(sentence, context)) return [sentence];
  const ending = sentence.match(/[。！？!?]$/)?.[0] ?? "。";
  const body = sentence.replace(/[。！？!?]$/, "").trim();
  if (!body) return [];
  const clauses = body.split(/[，、；;]|和|还有|以及/).map((part) => part.trim()).filter(Boolean);
  const buckets = new Map<string, string[]>();
  const push = (dish: string, clause: string) => {
    const key = dish || "_";
    buckets.set(key, [...(buckets.get(key) ?? []), clause]);
  };
  let currentDish = "";
  for (const clause of clauses) {
    const named = dishesInText(clause)[0] || "";
    const attrOwner = ownerOfPhrase(clause, context);
    const attrOk = Boolean(attrOwner && evidencedDish(attrOwner, context));
    if (named && attrOk && attrOwner !== named) {
      push(attrOwner, clause.split(named).join(attrOwner));
      currentDish = attrOwner;
      continue;
    }
    if (!named && attrOk && attrOwner !== currentDish) {
      push(attrOwner, clause);
      continue;
    }
    const target = named || currentDish || (attrOk ? attrOwner : "");
    if (named) currentDish = named;
    push(target, clause);
  }
  return [...buckets.entries()]
    .map(([dish, items]) => renderDishClauses(dish === "_" ? "" : dish, items))
    .filter((item) => item.replace(/[。，\s]/g, "").length >= 2)
    .map((item) => (/[。！？!?]$/.test(item) ? item : `${item}${ending}`));
}

const LOOSE_DISH_CUES: Array<{ dish: string; pattern: RegExp }> = [
  { dish: "芒果糯米饭", pattern: /芒果|糯米/ },
  { dish: "菠萝炒饭", pattern: /菠萝/ },
  { dish: "咖喱蟹肉", pattern: /蟹/ },
  { dish: "青咖喱牛肉", pattern: /青咖喱|牛肉/ },
  { dish: "河虾冬阴功汤", pattern: /冬阴功/ },
  { dish: "炒空心菜", pattern: /空心菜/ },
  { dish: "滑蛋饭", pattern: /滑蛋/ },
  { dish: "青柠蒸鲈鱼", pattern: /鲈鱼|青柠/ },
  { dish: "蒜炒虾仁", pattern: /蒜炒|虾仁/ },
  { dish: "酸甜酱炒河虾", pattern: /酸甜酱|酸甜河虾/ },
];

function sentenceDish(sentence: string, introduced: string[] = []) {
  const named = dishesInText(sentence);
  if (named.length >= 1) return named[0];
  const hits = LOOSE_DISH_CUES.filter((item) => introduced.includes(item.dish) && item.pattern.test(sentence));
  return hits.length === 1 ? hits[0].dish : "";
}

function continuationClause(sentence: string, dish: string) {
  let text = sentence.replace(/[。！？!?]+$/, "").trim();
  for (const term of dishTerms(dish).sort((a, b) => b.length - a.length)) {
    if (term.length >= 2) text = text.split(term).join("");
  }
  return text
    .replace(/^[，、的\s]*(接着|然后|还有|以及|再来)?/, "")
    .replace(/^[，、的\s]+/, "")
    .replace(/[，、\s]+$/, "")
    .trim();
}

function hasNewFact(sentence: string, already: string) {
  const clean = sentence.replace(/[。！？!?，、\s]/g, "");
  const prior = already.replace(/[。！？!?，、\s]/g, "");
  const extras = ["份量", "下饭", "蒜香", "Q弹", "粘度", "不会太甜", "椰香", "软烂", "辣度", "酸辣", "虾很大", "嫩", "锅气"];
  return extras.some((token) => clean.includes(token) && !prior.includes(token));
}

function isEndingSentence(sentence: string) {
  return ENDING.test(sentence) && (dishesInText(sentence).length === 0 || /下次|整体|刚好在centralwOrld/.test(sentence));
}

function isBarePlaceClause(clause: string) {
  const body = clause.replace(/[。！？!?\s]/g, "").replace(/BaanYing/gi, "BaanYing");
  if (!/BaanYing|centralwOrld|尚泰世界购物中心/i.test(body)) return false;
  if (/服务|老板|小朋友|小孩子|孩子|妈妈|爸爸|老公|老婆|男朋友|女朋友/.test(body)) return false;
  const leftover = body
    .replace(/BaanYing/gi, "")
    .replace(/centralwOrld/g, "")
    .replace(/尚泰世界购物中心/g, "")
    .replace(/[0-9０-９]+楼/g, "")
    .replace(/这次|刚好|去了|来了|在|的|这家|就|顺便|逛街|逛|时候|吃|泰餐|饭|餐厅|很方便|比较方便|过来|最后/g, "");
  return leftover.length <= 1;
}

function isPersonReactionOnly(sentence: string) {
  if (sentenceDish(sentence)) return false;
  if (/BaanYing|Baan Ying|centralwOrld|尚泰世界购物中心|服务|老板|环境/i.test(sentence)) return false;
  return /小朋友|小孩子|孩子|妈妈|爸爸|老公|老婆|男朋友|女朋友|朋友/.test(sentence) && /喜欢|好吃|开心|觉得/.test(sentence);
}

function detachTrailingPlace(sentence: string) {
  const ending = sentence.match(/[。！？!?]$/)?.[0] ?? "。";
  const body = sentence.replace(/[。！？!?]+$/, "");
  const parts = body.split("，").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return [sentence];
  const splitAt = parts.findIndex((part, index) => index > 0 && isBarePlaceClause(part) && !isBarePlaceClause(parts[index - 1]));
  if (splitAt < 0) return [sentence];
  const head = parts.slice(0, splitAt).join("，");
  const tail = parts.slice(splitAt).join("，");
  if (!head || (!sentenceDish(head) && !/喜欢|好吃|服务|味道|轻松|舒服/.test(head))) return [sentence];
  return [`${head}${ending}`, `${tail}${ending}`];
}

function softenPlaceSentence(sentence: string) {
  if (!isBarePlaceClause(sentence) || /逛|顺便|方便|时候去了|的时候/.test(sentence)) return sentence;
  const floor = sentence.match(/[0-9０-９]+楼/)?.[0] ?? "";
  const mall = sentence.includes("尚泰世界购物中心") ? "尚泰世界购物中心" : sentence.includes("centralwOrld") ? "centralwOrld" : "";
  if (!mall || !/Baan\s*Ying/i.test(sentence)) return sentence;
  return floor ? `这次去了${mall} ${floor}的Baan Ying。` : `这次在${mall}的时候去了Baan Ying。`;
}

function collapsePlaceSentences(places: string[]) {
  if (places.length <= 1) return places;
  const rich = places.find(
    (item) => /方便|顺便|逛街/.test(item) && /Baan Ying/.test(item) && /centralwOrld|尚泰世界购物中心/.test(item),
  );
  if (rich) return [rich];
  const text = places.join("");
  const mall = text.includes("尚泰世界购物中心") ? "尚泰世界购物中心" : text.includes("centralwOrld") ? "centralwOrld" : "";
  if (mall && /Baan Ying/.test(text)) return [`这次在${mall}的时候去了Baan Ying。`];
  return [places[0]];
}

function settleOneVisit(sentences: string[]) {
  const flat = sentences.flatMap(detachTrailingPlace);
  const place: string[] = [];
  const meal: string[] = [];
  let seenMeal = false;
  let seenMall = false;
  let seenRestaurant = false;
  for (const sentence of flat) {
    const bare = isBarePlaceClause(sentence);
    const hasMall = /centralwOrld|尚泰世界购物中心/.test(sentence);
    const hasRestaurant = /Baan\s*Ying/i.test(sentence);
    if (bare) {
      const addsMall = hasMall && !seenMall;
      const addsRestaurant = hasRestaurant && !seenRestaurant;
      if (seenMeal && !addsMall && !addsRestaurant) continue;
      if (!seenMeal || addsMall || addsRestaurant) place.push(softenPlaceSentence(sentence));
      seenMall = seenMall || hasMall;
      seenRestaurant = seenRestaurant || hasRestaurant;
      continue;
    }
    if (sentenceDish(sentence) || /好吃|喜欢|服务|味道|老板|小朋友|小孩子|轻松|舒服/.test(sentence)) {
      seenMeal = true;
    }
    seenMall = seenMall || hasMall;
    seenRestaurant = seenRestaurant || hasRestaurant;
    meal.push(sentence);
  }
  const ordered = [...collapsePlaceSentences(place), ...meal];
  const attached: string[] = [];
  for (const sentence of ordered) {
    const previous = attached[attached.length - 1];
    if (previous && sentenceDish(previous) && isPersonReactionOnly(sentence)) {
      const detail = sentence.replace(/[。！？!?]+$/, "");
      attached[attached.length - 1] = `${previous.replace(/[。！？!?]$/, "，")}${detail}。`;
      continue;
    }
    attached.push(sentence);
  }
  return attached;
}

export function ensureNarrativeFlow(caption: string, context: CoverTitleContext = {}, map: EvidenceMap) {
  let sentences = splitSentences(caption)
    .flatMap((sentence) => fixCrossDishAttributes(sentence, context))
    .filter((item) => item.replace(/[。，\s]/g, "").length >= 2);
  const merged: string[] = [];
  const firstByDish = new Map<string, number>();
  for (const sentence of sentences) {
    const dish = sentenceDish(sentence, [...firstByDish.keys()]);
    if (!dish) {
      merged.push(sentence);
      continue;
    }
    const existing = firstByDish.get(dish);
    if (existing === undefined) {
      firstByDish.set(dish, merged.length);
      merged.push(sentence);
      continue;
    }
    if (/回头|相比|比起|对比/.test(sentence)) {
      merged.push(sentence);
      continue;
    }
    const previous = merged[existing] ?? "";
    const detail = continuationClause(sentence, dish);
    if (!detail || previous.includes(detail)) continue;
    if (WEAK_RESTATE.test(detail) && !hasNewFact(sentence, previous) && detail.replace(/我很喜欢|这次比较喜欢|还蛮喜欢|比较有记忆点|很好吃/g, "").replace(/[，、\s]/g, "").length < 4) {
      continue;
    }
    merged[existing] = `${previous.replace(/[。！？!?]$/, "，")}${detail}。`;
  }
  const endingIndex = merged.findIndex((sentence) => isEndingSentence(sentence));
  if (endingIndex >= 0 && endingIndex < merged.length - 1) {
    const after = merged.slice(endingIndex + 1);
    const keep: string[] = [];
    const move: string[] = [];
    for (const sentence of after) {
      const dish = sentenceDish(sentence);
      const alreadyBeforeEnding = dish && merged.slice(0, endingIndex).some((item) => sentenceDish(item) === dish);
      if (alreadyBeforeEnding) {
        continue;
      }
      if (dish) {
        move.push(sentence);
      } else {
        keep.push(sentence);
      }
    }
    merged.splice(endingIndex, merged.length - endingIndex, ...move, merged[endingIndex], ...keep);
  }
  const primary = map.primaryKind === "dish" ? map.primaryContent : "";
  if (primary) {
    const scene: string[] = [];
    const dishes: string[] = [];
    const rest: string[] = [];
    let seenDish = false;
    for (const sentence of merged) {
      const dish = sentenceDish(sentence);
      if (!dish && !seenDish) scene.push(sentence);
      else if (dish) {
        seenDish = true;
        dishes.push(sentence);
      } else rest.push(sentence);
    }
    const primaryLines = dishes.filter((item) => sentenceDish(item) === primary);
    const otherLines = dishes.filter((item) => sentenceDish(item) !== primary);
    sentences = [...scene, ...primaryLines, ...otherLines, ...rest];
  } else {
    sentences = merged;
  }
  return joinSentences(settleOneVisit(sentences.filter(Boolean)));
}
