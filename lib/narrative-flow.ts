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
  const groups = buildNarrativeGroups(context, map);
  const groupBlock = groups
    .map((group, index) => `GROUP ${index + 1} — ${group.label}\n${group.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
  return `NARRATIVE FLOW & ATTRIBUTE CONSISTENCY — additive.

Before writing the caption, decide this order and use each fact ONCE, in the best slot:
Opening → Context / Experience → Primary Content → Supporting Content → Secondary Detail → Natural Ending.

Do NOT stitch answers in form order. Do NOT finish dish A, go to dish B, summarize, then come back to dish A.

THIS ROUND FACT GROUPS (re-order into a natural story; do not dump every group):
${groupBlock || "none"}

Same-dish facts stay in ONE semantic stretch.
GOOD: 咖喱蟹肉份量很足，搭配米饭很下饭，也是这次比较喜欢的一道。
BAD: 咖喱蟹肉份量很足…… later ……咖喱蟹肉我很喜欢。

ATTRIBUTE OWNERSHIP is strict. A taste/texture/reason belongs to one dish only.
Never write 咖喱蟹肉蒜香味很足 if 蒜香 belongs to 蒜炒虾仁.
Never write 蒜炒虾仁浓厚的椰香味 / 软烂的牛肉 — those belong to 青咖喱牛肉.
${UNIQUE_ATTRS.map((item) => `${item.dishes[0]} ← ${item.label}`).join("\n")}
After writing, check Dish → Attribute / Reason / Opinion / Experience. Fix cross-dish mixups. Do not dump every customer word onto the primary dish.

Do not restate a finished dish unless the new sentence adds a real unused customer fact. Delete the restatement.

After Ending = true, do not open a new dish review. Move that sentence into the earlier dish block, or delete it.
Natural flow > covering every answer. Keep explicit negatives and clear attitudes.

Read-through test: each sentence should answer the last; same dish not split; no coming back; attributes on the right dish; last two sentences end, they do not start a new thread.`;
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

function sentenceDish(sentence: string) {
  return dishesInText(sentence)[0] || "";
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

export function ensureNarrativeFlow(caption: string, context: CoverTitleContext = {}, map: EvidenceMap) {
  let sentences = splitSentences(caption)
    .flatMap((sentence) => fixCrossDishAttributes(sentence, context))
    .filter((item) => item.replace(/[。，\s]/g, "").length >= 2);
  const merged: string[] = [];
  const firstByDish = new Map<string, number>();
  for (const sentence of sentences) {
    const dish = sentenceDish(sentence);
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
    const previous = merged[existing] ?? "";
    if (WEAK_RESTATE.test(sentence) && !hasNewFact(sentence, previous)) continue;
    if (hasNewFact(sentence, previous)) {
      merged[existing] = `${previous.replace(/[。！？!?]$/, "，")}${sentence.replace(/^[^，。]*?(份量|下饭|蒜香|Q弹|粘度|不会太甜|椰香|软烂|辣度|酸辣|嫩|锅气)/, "$1")}`;
      continue;
    }
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
  return joinSentences(sentences.filter(Boolean));
}
