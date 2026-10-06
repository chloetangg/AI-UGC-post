const DISH =
  /芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|酸甜酱炒河虾/;
const DRINK = /粉红奶|泰奶|珍珠奶茶|柠檬茶|咖啡|果汁|椰汁/;
const RICH = /奶香|层次|香气|锅气|配料|Q弹|蒜香|甜度|粘度|软烂|虾很大|酸辣/;
const ENJOY = /真是种享受|真是一种享受|是种享受/;

type Slot = "scene" | "food" | "drink" | "feeling" | "close";

function splitGluedTopics(text: string) {
  return text
    .replace(/(\p{Extended_Pictographic})\s*(餐厅|环境|氛围|服务|老板)/gu, "$1。$2")
    .replace(
      /(酸甜酱炒河虾|河虾冬阴功汤|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|芒果糯米饭|青柠蒸鲈鱼|蒜炒虾仁|炒空心菜|冬阴功)(餐厅|环境|氛围|服务|老板)/g,
      "$1。$2",
    );
}

function sentencesOf(caption: string) {
  return splitGluedTopics(caption)
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[。！？!?])/u))
    .map((part) => part.trim())
    .filter((part) => part.replace(/[。！？!?\s]/g, "").length >= 2);
}

function withEnd(text: string) {
  const trimmed = text.trim().replace(/[，、]+$/g, "");
  if (!trimmed) return "";
  if (/[。！？!?]$/.test(trimmed) || /\p{Extended_Pictographic}$/u.test(trimmed)) return trimmed;
  return `${trimmed}。`;
}

function sceneClause(part: string) {
  if (DISH.test(part) || DRINK.test(part)) return false;
  return /逛|购物|经过|centralwOrld|第一次来|楼|Baan\s*Ying|吃一顿/i.test(part);
}

function isCloseClause(part: string) {
  return /整体感觉|很满意|吃下来|整体吃下来|很满足|真是种享受|是种享受/.test(part) && !DISH.test(part) && !DRINK.test(part);
}

function isRoomClause(part: string) {
  return /氛围|环境|家庭式|温馨|坐在|坐着|坐起来/.test(part) && !DISH.test(part);
}

function isAddressClause(part: string) {
  return /尚泰世界购物中心|分店就在|这家(?:店|分店)?就在|就在.*[0-9０-９]+楼/.test(part) && !DISH.test(part);
}

function peel(sentence: string) {
  const body = sentence.replace(/[。！？!?]+$/g, "").trim();
  const parts = body.split(/[，,]/).map((part) => part.trim()).filter((part) => part && !isAddressClause(part));
  const closeBits = parts.filter(isCloseClause);
  const roomBits = parts.filter((part) => !closeBits.includes(part) && isRoomClause(part));
  const kept = parts.filter((part) => !closeBits.includes(part) && !roomBits.includes(part));
  const sceneParts = kept.filter(sceneClause);
  const otherParts = kept.filter((part) => !sceneClause(part));
  const out: string[] = [];
  if (sceneParts.length > 0) out.push(withEnd(sceneParts.join("，")));
  if (otherParts.length > 0) out.push(withEnd(otherParts.join("，")));
  if (roomBits.length > 0) out.push(withEnd(roomBits.join("，")));
  if (closeBits.length > 0) out.push(withEnd(closeBits.join("，")));
  return out.length > 0 ? out : [withEnd(body)];
}

function slotOf(sentence: string): Slot {
  const text = sentence.replace(/\p{Extended_Pictographic}/gu, "");
  if (isAddressClause(text)) return "scene";
  if (isCloseClause(text) || (ENJOY.test(text) && !DISH.test(text))) return "close";
  if (DRINK.test(text) && !DISH.test(text) && !/逛|购物|经过/.test(text)) return "drink";
  if (isRoomClause(text) || (/老板|服务/.test(text) && !DISH.test(text) && !DRINK.test(text))) return "feeling";
  if (sceneClause(text) && !DISH.test(text) && !RICH.test(text)) return "scene";
  if (/舒服|放松/.test(text) && !DISH.test(text)) return "feeling";
  if (DISH.test(text) || RICH.test(text) || /大头虾|份量/.test(text)) return "food";
  if (/方便/.test(text) && /central\s*world|逛|商场/i.test(text)) return "scene";
  return "food";
}

function richness(sentence: string) {
  return RICH.source.split("|").filter((token) => sentence.includes(token)).length;
}

function mallCount(text: string) {
  return text.match(/central\s*world/gi)?.length ?? 0;
}

function tidyJoin(text: string) {
  return text
    .replace(/来\s*的/g, "刚好来")
    .replace(/的{2,}/g, "的")
    .replace(/[，,]\s*[，,]/g, "，")
    .replace(/\s{2,}/g, " ")
    .replace(/^[，,\s]+/, "")
    .trim();
}

function collapseMallInSentence(sentence: string) {
  if (mallCount(sentence) < 2) return sentence;
  let next = sentence.replace(
    /(逛完|逛了|逛街|购物完|经过)\s*(central\s*world)\s*[，,]\s*(?:这次)?(?:来|去|在)\s*central\s*world\s*的/i,
    "$1$2，刚好来",
  );
  if (mallCount(next) >= 2) {
    let seen = false;
    next = next.replace(/central\s*world/gi, (match) => {
      if (!seen) {
        seen = true;
        return match;
      }
      return "";
    });
  }
  return tidyJoin(next);
}

function collapseRestaurant(sentence: string) {
  let seen = false;
  return tidyJoin(
    sentence.replace(/baan\s*ying/gi, (match) => {
      if (!seen) {
        seen = true;
        return match;
      }
      return "";
    }),
  );
}

function mergeScenes(scenes: string[], laterMeal: string) {
  if (scenes.length === 0) return [];
  const blob = scenes.join("");
  const awkward = scenes.length > 1 || /经过|购物完/.test(blob);
  if (!awkward) return scenes;
  const floor = blob.match(/[0-9０-９]+楼/)?.[0] ?? "";
  const mallWord = blob.match(/central\s*world/i)?.[0] ?? "";
  const mall = Boolean(mallWord);
  const shop = /逛|购物|经过/.test(blob);
  const restaurant = /Baan\s*Ying/i.test(blob);
  const firstVisit = /第一次来/.test(blob);
  const convenient = /方便/.test(blob);
  const mealWord = /泰餐/.test(`${blob}${laterMeal}`) ? "泰餐" : "饭";
  const closeOwnsMeal = /吃一顿/.test(laterMeal);
  if (mall && shop && (restaurant || floor)) {
    const where = restaurant ? "Baan Ying" : floor ? "这里" : "这里";
    const first = firstVisit ? "第一次来，" : "";
    const ease = convenient ? "，也比较方便" : "";
    const meal = closeOwnsMeal ? "吃饭" : `吃一顿${mealWord}`;
    const bridge = scenes.length > 1 ? "刚好来" : "来";
    return [withEnd(`${first}逛完${mallWord}，${bridge}${where}${meal}${ease}`)];
  }
  if (mall && shop) {
    const meal = closeOwnsMeal ? "吃饭" : `吃一顿${mealWord}`;
    return [withEnd(`逛完${mallWord}，来这里${meal}${convenient ? "，也比较方便" : ""}`)];
  }
  return scenes;
}

function dedupeRepeatedFacts(caption: string) {
  const sentences = sentencesOf(caption).map((sentence) => collapseRestaurant(collapseMallInSentence(sentence)));
  const out: string[] = [];
  let seenFirst = false;
  let seenIdentity = false;
  let seenService = false;
  let seenRoom = false;
  const seenDish = new Set<string>();
  for (const raw of sentences) {
    let sentence = raw;
    if (/第一次/.test(sentence)) {
      if (seenFirst) sentence = tidyJoin(sentence.replace(/第一次(?:来|到)?(?:这家|这里|baan\s*ying)?/gi, ""));
      seenFirst = true;
    }
    if (/游客|本地人/.test(sentence)) {
      if (seenIdentity) sentence = tidyJoin(sentence.replace(/游客|本地人/g, ""));
      seenIdentity = true;
    }
    if (/服务/.test(sentence)) {
      if (seenService && !DISH.test(sentence) && sentence.replace(/服务|真的|很|好|也不错|。/g, "").trim().length < 2) continue;
      seenService = true;
    }
    if (/环境|氛围/.test(sentence)) {
      if (seenRoom && !DISH.test(sentence) && sentence.replace(/环境|氛围|很|舒服|放松|。/g, "").trim().length < 2) continue;
      seenRoom = true;
    }
    const dish = sentence.match(DISH)?.[0] ?? "";
    if (dish && seenDish.has(dish)) {
      const earlier = out.find((item) => item.includes(dish)) ?? "";
      const extra = sentence
        .replace(/[。！？!?]/g, "")
        .split("，")
        .map((part) => part.replace(dish, "").replace(/^[，、\s]+/, "").trim())
        .filter((part) => part && !earlier.includes(part) && !/^(?:真的)?很?(?:好吃|好喝|推荐|不错)$/.test(part));
      if (extra.length === 0) continue;
      const index = out.findIndex((item) => item.includes(dish));
      if (index >= 0) out[index] = withEnd(`${out[index].replace(/[。！？!?]+$/g, "")}，${extra.join("，")}`);
      continue;
    }
    if (dish) seenDish.add(dish);
    const previous = out.at(-1) ?? "";
    if (
      mallCount(previous) &&
      mallCount(sentence) &&
      !DISH.test(sentence) &&
      !/baan\s*ying/i.test(previous) &&
      /baan\s*ying/i.test(sentence)
    ) {
      const name = sentence.match(/baan\s*ying/i)?.[0] ?? "Baan Ying";
      const floor = sentence.match(/[0-9０-９]+楼/)?.[0] ?? "";
      out[out.length - 1] = withEnd(
        `${previous.replace(/[。！？!?]+$/g, "")}，刚好来${floor ? `${floor}的` : ""}${name}吃一顿饭`,
      );
      continue;
    }
    if (mallCount(previous) && mallCount(sentence) && !DISH.test(previous) && !DISH.test(sentence)) {
      const leftover = sentence.replace(/central\s*world|baan\s*ying|逛完|逛街|购物|经过|来|去|吃一顿|吃饭|泰餐|的|很|方便/gi, "");
      if (leftover.replace(/[。！？!?\s]/g, "").length < 2) continue;
    }
    const cleaned = tidyJoin(sentence);
    if (cleaned.replace(/[。！？!?\s，,]/g, "").length >= 2) out.push(withEnd(cleaned));
  }
  return out.map(withEnd).join("");
}

function isAddressLine(sentence: string) {
  return isAddressClause(sentence.replace(/[。！？!?]/g, ""));
}

function completeDrink(sentence: string) {
  const name = sentence.match(DRINK)?.[0] ?? "";
  if (!name || DISH.test(sentence)) return sentence;
  const rest = sentence
    .replace(/再配上|最后|一杯|也|很|真的|这杯|配上/g, "")
    .replace(name, "")
    .replace(/[。！？!?\s，,]/g, "");
  if (/甜|解辣|清爽|香甜|浓郁/.test(sentence)) return sentence;
  if (rest.length <= 2 || /^再配上一杯/.test(sentence)) {
    return withEnd(`再配上一杯${name}，这顿饭也就更完整了`);
  }
  return sentence;
}

function softenSideDish(sentence: string) {
  const dish = sentence.match(DISH)?.[0] ?? "";
  if (!dish || RICH.test(sentence) || /下饭|份量|奶香/.test(sentence)) return sentence;
  if (/推荐|试试/.test(sentence)) return withEnd(`${dish}也值得试试`);
  const rest = sentence.replace(dish, "").replace(/[。！？!?\s，,也]/g, "");
  if (/^(?:真的)?很?(?:好吃|好喝|不错|推荐)$/.test(rest)) return withEnd(`另外${dish}也还不错`);
  return sentence;
}

function mergeRoom(sentences: string[]) {
  const room = sentences.filter((sentence) => isRoomClause(sentence) || /舒服|坐/.test(sentence));
  const other = sentences.filter((sentence) => !room.includes(sentence));
  if (room.length === 0) return other;
  const blob = room.join("");
  const merged =
    /家庭|温馨/.test(blob) && /坐|舒服/.test(blob)
      ? "餐厅整体是家庭式的温馨氛围，坐在里面吃饭感觉很舒服。"
      : withEnd(room.map((sentence) => sentence.replace(/[。！？!?]+$/g, "")).join("，"));
  return [merged, ...other];
}

function attachFoodDetails(foods: string[]) {
  const details = foods.filter((sentence) => !DISH.test(sentence) && /大头虾|份量|奶香|锅气|配料/.test(sentence));
  const named = foods.filter((sentence) => !details.includes(sentence));
  for (const detail of details) {
    const hostIndex = named.findIndex((sentence) => /冬阴功|河虾/.test(sentence) && /奶香|大头虾|份量/.test(detail));
    const index = hostIndex >= 0 ? hostIndex : named.findIndex((sentence) => DISH.test(sentence));
    if (index < 0) {
      named.push(detail);
      continue;
    }
    const clause = detail.replace(/[。！？!?]+$/g, "");
    if (!named[index].includes(clause)) named[index] = withEnd(`${named[index].replace(/[。！？!?]+$/g, "")}，${clause}`);
  }
  return named;
}

function paragraph(sentences: string[]) {
  return sentences.map(withEnd).filter(Boolean).join("");
}

/** Put one visit in lived order: arrival, the dish they dwelled on, the rest of the meal, then how it felt. */
export function arrangeDiningStory(caption: string) {
  const sentences = sentencesOf(caption).flatMap(peel).filter((sentence) => !isAddressLine(sentence));
  if (sentences.length < 2) return dedupeRepeatedFacts(caption.trim());
  const buckets: Record<Slot, string[]> = { scene: [], food: [], drink: [], feeling: [], close: [] };
  for (const sentence of sentences) {
    const slot = slotOf(sentence);
    if (slot === "scene" && isAddressLine(sentence)) continue;
    buckets[slot].push(sentence);
  }
  const foods = attachFoodDetails([...buckets.food].sort((a, b) => richness(b) - richness(a)));
  const hero = foods[0] ? [foods[0]] : [];
  const sides = foods.slice(1).map(softenSideDish);
  const drinks = buckets.drink.map(completeDrink);
  const ending = [...mergeRoom(buckets.feeling), ...drinks, ...buckets.close];
  const cleaned = sentencesOf(
    dedupeRepeatedFacts(
      [...mergeScenes(buckets.scene.filter((sentence) => !isAddressLine(sentence)), ""), ...hero, ...sides, ...ending].join(""),
    ),
  );
  const scene = cleaned.filter((sentence) => slotOf(sentence) === "scene");
  const meal = cleaned.filter((sentence) => slotOf(sentence) === "food");
  const close = cleaned.filter((sentence) => slotOf(sentence) === "feeling" || slotOf(sentence) === "drink" || slotOf(sentence) === "close");
  return [paragraph(scene), paragraph(meal), paragraph(close)]
    .filter((block) => block.replace(/[。！？!?\s]/g, "").length >= 2)
    .join("\n\n");
}
