const DISH =
  /芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|酸甜酱炒河虾/;
const DRINK = /粉红奶|泰奶|珍珠奶茶|柠檬茶|咖啡|果汁|椰汁/;
const RICH = /奶香|层次|香气|锅气|配料|Q弹|蒜香|甜度|粘度|软烂|虾很大|酸辣/;
const ENJOY = /真是种享受|真是一种享受|是种享受/;

type Slot = "scene" | "food" | "drink" | "feeling" | "close";

function splitGluedTopics(text: string) {
  const dish = "酸甜酱炒河虾|河虾冬阴功汤|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|芒果糯米饭|青柠蒸鲈鱼|蒜炒虾仁|炒空心菜|冬阴功";
  const dishEdge = "酸甜酱炒河虾|河虾冬阴功汤|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|芒果糯米饭|青柠蒸鲈鱼|蒜炒虾仁|炒空心菜";
  const next = text
    .replace(/(?<=\p{Script=Han})(\p{Extended_Pictographic}\uFE0F?)\s*(餐厅|环境|氛围|服务|老板|店员)/gu, "。$1$2")
    .replace(new RegExp(`(${dish})(餐厅|环境|氛围|服务|老板|店员)`, "g"), "$1。$2")
    .replace(/(新鲜|开胃|提鲜|丰富|好吃|好喝)(店员|服务)/g, "$1。$2")
    .replace(new RegExp(`([^。！？!?\\n和与的、，\\s\\p{Extended_Pictographic}])(${dishEdge})`, "gu"), (full, before: string, name: string, offset: number, whole: string) => {
      const prefix = whole.slice(Math.max(0, offset - 12), offset + before.length);
      if (/喜欢|是$|点了|吃了|选了|的$|和$|与$|还有|以及|里面|这几道|然后/.test(prefix)) return full;
      return `${before}。${name}`;
    });
  return next.replace(
    new RegExp(`([^。！？!?\\n和与的、，\\s])(\\p{Extended_Pictographic}\\uFE0F?)(${dishEdge})`, "gu"),
    (full, before: string, emoji: string, name: string, offset: number, whole: string) => {
      const prefix = whole.slice(Math.max(0, offset - 8), offset + before.length);
      if (/喜欢|是$|点了|吃了|选了|的$|和$|与$|还有|以及|然后/.test(prefix)) return full;
      return `${before}${emoji}。${name}`;
    },
  );
}

/** "我比较喜欢。" only exists because a dish was cut off. Put that dish back in the same sentence. */
function rejoinDangling(parts: string[]) {
  const out: string[] = [];
  for (const part of parts) {
    const previous = out.at(-1);
    const stem = previous?.replace(/[。！？!?]+$/u, "").trim() ?? "";
    if (previous && /(?:比较喜欢|最喜欢|很喜欢|我喜欢|喜欢|的是|几道里面|这几道里)$/.test(stem)) {
      out[out.length - 1] = `${stem}${part.replace(/^[，、\s]+/u, "")}`;
    } else out.push(part);
  }
  return out;
}

function sentencesOf(caption: string) {
  const parts = splitGluedTopics(caption)
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[。！？!?])|(?<=\p{Extended_Pictographic}\uFE0F?)\s+(?=\p{Script=Han})/u))
    .map((part) => part.trim())
    .filter((part) => part.replace(/[。！？!?\s]/g, "").length >= 1);
  const merged: string[] = [];
  for (const part of parts) {
    const words = part.replace(/[。！？!?\s\p{Extended_Pictographic}]/gu, "");
    if (words.length === 0 && merged.length > 0) merged[merged.length - 1] += part;
    else if (words.length >= 2 || (words.length > 0 && merged.length === 0)) merged.push(part);
  }
  return rejoinDangling(merged);
}

function withEnd(text: string) {
  const trimmed = text.trim().replace(/[，、]+$/g, "");
  if (!trimmed) return "";
  if (/[。！？!?]$/.test(trimmed) || /\p{Extended_Pictographic}$/u.test(trimmed)) return trimmed;
  return `${trimmed}。`;
}

function isArrivalClause(part: string) {
  return /朋友|同事|听说|约上|终于|之前提过|推荐过来|老婆|老公|一家人|带着一家/.test(part) && !DISH.test(part) && !DRINK.test(part);
}

function sceneClause(part: string) {
  if (DISH.test(part) || DRINK.test(part)) return false;
  return isArrivalClause(part) || /逛|购物|经过|centralwOrld|第一次来|楼|Baan\s*Ying|吃一顿/i.test(part);
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
  if (isArrivalClause(text) || (sceneClause(text) && !DISH.test(text) && !RICH.test(text))) return "scene";
  if (/舒服|放松/.test(text) && !DISH.test(text)) return "feeling";
  if (DISH.test(text) || RICH.test(text) || /大头虾|份量/.test(text)) return "food";
  if (/方便/.test(text) && /central\s*world|逛|商场/i.test(text)) return "scene";
  return "food";
}

function isEmptyPraise(sentence: string) {
  if (DISH.test(sentence) || DRINK.test(sentence)) return false;
  return /^(?:这顿|整体|吃起来|吃着|吃下来).{0,12}(?:味道)?很?(?:正宗|满足|满意|不错)。?$/.test(sentence.replace(/\s/g, ""));
}

function isStockCloser(sentence: string) {
  if (DISH.test(sentence) || DRINK.test(sentence) || /服务|店员/.test(sentence)) return false;
  const plain = sentence.replace(/[。！？!?\s]/g, "");
  if (isEmptyPraise(sentence)) return true;
  if (/熟悉的泰式风味/.test(plain) && /正宗/.test(plain)) return true;
  if (/^吃下来感觉很顺畅$/.test(plain)) return true;
  if (/^(?:整体)?吃(?:起来|着|下来)很满足$/.test(plain)) return true;
  if (/^(?:在小红薯上|在小红书上)?也?挺有人气的?$|^有人气$/.test(plain)) return true;
  if (/^(?:每|这)次来(?:基本)?都会点的?$|^每次来$/.test(plain)) return true;
  if (/^(?:口感甜润|甜润|甜丝丝|甜而不腻)$/.test(plain)) return true;
  if (/^(?:拌饭吃?)?(?:超香|很香|香喷喷)$/.test(plain)) return true;
  return false;
}

function trimGenericClauses(sentence: string, note: string) {
  const parts = sentence.replace(/[。！？!?]+$/g, "").split("，");
  if (parts.length < 2) return sentence;
  const kept = parts.filter((part) => {
    if (/印象(最|比较)?深/.test(part) && !/印象/.test(note)) return false;
    if (/还想点|还会想再点/.test(part) && !/还想点|再点/.test(note)) return false;
    if (/心情/.test(part) && !/心情/.test(note)) return false;
    if (/汤头|顺口/.test(part) && !/汤头|顺口/.test(note)) return false;
    if (/招呼/.test(part) && !/招呼/.test(note)) return false;
    if (/很舒服/.test(part) && !/舒服/.test(note) && /服务|店员/.test(sentence)) return false;
    return true;
  });
  if (kept.length === 0) return sentence;
  return withEnd(kept.join("，"));
}

function isUnrequestedStock(sentence: string, note: string) {
  if (!isStockCloser(sentence)) return false;
  const plain = sentence.replace(/[。！？!?\s]/g, "");
  if (/正宗/.test(plain) && /正宗/.test(note)) return false;
  if (/熟悉的泰式风味/.test(plain) && /熟悉的泰式风味/.test(note)) return false;
  if (/顺畅/.test(plain) && /顺畅/.test(note)) return false;
  if (/满足/.test(plain) && /满足/.test(note)) return false;
  if (/有人气/.test(plain) && /人气/.test(note)) return false;
  if (/每次来|都会点/.test(plain) && /每次|常去|常来|又来/.test(note)) return false;
  if (/甜润|甜丝丝|甜而不腻|口感甜/.test(plain) && /甜/.test(note)) return false;
  if (/超香|很香|香喷喷/.test(plain) && /香/.test(note)) return false;
  return true;
}

function sameDish(left: string, right: string) {
  return left === right || left.includes(right) || right.includes(left);
}

/** A taste counts for a dish only when that dish is named in the same evidence clause. A taste with no dish stays unassigned. */
function tasteSupportedFor(evidence: string, taste: RegExp, dishes: string[]) {
  if (!taste.test(evidence)) return false;
  if (dishes.length === 0) return true;
  let unbound = false;
  const bound: string[] = [];
  for (const clause of evidence.split(/[。！？!?\n；;，,、]/)) {
    if (!clause.trim() || !taste.test(clause)) continue;
    const named = namesIn(clause);
    if (named.length === 0) unbound = true;
    else bound.push(...named);
  }
  if (unbound || bound.length === 0) return true;
  return dishes.some((dish) => bound.some((name) => sameDish(dish, name)));
}

function stripUnsupportedSpans(part: string, evidence: string, dishes: string[]) {
  let next = part;
  if (!/人气/.test(evidence)) next = next.replace(/也?挺有人气的?|人气比较高|有人气/g, "");
  if (!/小红薯|小红书/.test(evidence)) next = next.replace(/在小红薯上|在小红书上/g, "");
  if (!/每次|常去|常来|又来/.test(evidence)) {
    next = next.replace(/(?:每|这)次来基本都会点的?|(?:每|这)次来都会点|每次基本都会点|每次来|基本都会点/g, "");
  }
  if (!tasteSupportedFor(evidence, /香/, dishes)) next = next.replace(/拌饭吃超香|拌饭超香|香喷喷|超香|很香/g, "");
  if (!tasteSupportedFor(evidence, /甜润|甜丝丝|甜而不腻|口感甜/, dishes)) {
    next = next.replace(/口感甜润|甜而不腻|甜丝丝|甜润/g, "");
  }
  if (!tasteSupportedFor(evidence, /满足/, dishes)) {
    next = next.replace(/(?:这顿)?吃(?:起来|着|下来)很满足|这顿吃下来很满足/g, "");
  }
  if (!/多吃|半碗|不知不觉/.test(evidence)) next = next.replace(/不知不觉就?多吃了半碗/g, "");
  return next.replace(/^[，、\s]+|[，、\s]+$/g, "").replace(/[，、]{2,}/g, "，").trim();
}

function clauseStillSaysSomething(part: string) {
  const plain = part.replace(/[。！？!?\s，、]/g, "");
  if (!plain) return false;
  return !/^(?:的|也|就|吃|拌饭|基本|每次|这顿|整体)+$/.test(plain);
}

/** Drop an unsupported add-on. Keep the same clause's dish and the evaluation the customer actually gave. */
export function stripUnsupportedAdditions(caption: string, evidence = "") {
  return caption
    .split(/\n\n+/)
    .map((block) =>
      sentencesOf(block)
        .flatMap((sentence) => {
          const body = sentence.replace(/[。！？!?]+$/g, "");
          const sentenceDishes = namesIn(body);
          const kept = body
            .split("，")
            .map((part) => {
              const local = namesIn(part);
              return stripUnsupportedSpans(part, evidence, local.length > 0 ? local : sentenceDishes);
            })
            .filter(clauseStillSaysSomething);
          if (kept.length === 0) return [];
          return [withEnd(kept.join("，"))];
        })
        .join(""),
    )
    .filter((block) => block.replace(/[。！？!?\s]/g, "").length >= 2)
    .join("\n\n");
}

function noteClauses(note: string) {
  return note.split(/[。！？!?\n，,]/);
}

function noteGivesTasteToDish(note: string, dish: string, taste: string) {
  return noteClauses(note).some((clause) => clause.includes(taste) && clause.includes(dish));
}

function restoreNotedTastes(sentence: string, note: string) {
  const dish = sentence.match(DISH)?.[0] ?? "";
  if (!dish || !note.trim()) return sentence;
  const extras = noteClauses(note).flatMap((clause) => {
    if (!clause.includes(dish)) return [];
    const taste = clause.match(/开胃|新鲜|配料足|提鲜/)?.[0];
    if (!taste || sentence.includes(taste === "配料足" ? "配料" : taste)) return [];
    const extra = clause.replace(dish, "").replace(/^[的虾真很也\s]+/, "").trim();
    return extra ? [extra] : [];
  });
  if (extras.length === 0) return sentence;
  return withEnd(`${sentence.replace(/[。！？!?]+$/g, "")}，${extras.join("，")}`);
}

function dropUnnotedTasteClauses(sentences: string[], note: string) {
  if (!note.trim()) return sentences;
  const tastes = ["开胃", "新鲜", "提鲜"];
  return sentences.flatMap((sentence) => {
    const dish = sentence.match(DISH)?.[0] ?? "";
    const parts = sentence.replace(/[。！？!?]+$/g, "").split("，");
    if (!dish || parts.length < 2) return [sentence];
    const kept = parts.filter((part) => {
      const taste = tastes.find((item) => part.includes(item));
      if (!taste || noteGivesTasteToDish(note, dish, taste)) return true;
      const notedOnAnotherDish = noteClauses(note).some(
        (clause) => clause.includes(taste) && DISH.test(clause) && !clause.includes(dish),
      );
      if (!notedOnAnotherDish) return true;
      const bare = part.replace(dish, "").replace(/喝起来|吃起来|起来|也很|真的|很|这道/g, "").replace(taste, "").trim();
      return bare.length >= 2;
    });
    if (kept.length === 0) return [];
    return [withEnd(kept.join("，"))];
  });
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
        .filter((part) => {
          if (!part || earlier.includes(part)) return false;
          if (/^(?:真的)?很?(?:好吃|好喝|推荐|不错|新鲜|正宗|满足)$/.test(part)) return false;
          if (/印象最深|吃下来印象/.test(part) && /新鲜|好吃|好喝/.test(earlier)) return false;
          if (/新鲜|好吃|好喝/.test(part) && /新鲜|好吃|好喝/.test(earlier)) {
            const core = part
              .replace(/新鲜|好吃|好喝|吃着|真的|很|这道|汤/g, "")
              .replace(/[，。！？!?\s]/g, "");
            if (/^(?:河?虾)?$/.test(core)) return false;
          }
          return true;
        });
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
  if (/好喝|好吃|不错|喜欢|甜|解辣|清爽|香甜|浓郁|完整/.test(sentence)) return sentence;
  const rest = sentence.replace(name, "").replace(/[。！？!?\s，,再配上最后一杯也很真的这杯]/g, "");
  if (rest.length > 0) return sentence;
  return withEnd(name);
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

function namedFood() {
  return /河虾冬阴功汤|酸甜酱炒河虾|青柠蒸鲈鱼|芒果糯米饭|咖喱蟹肉|青咖喱牛肉|蒜炒虾仁|菠萝炒饭|炒空心菜|滑蛋饭|冬阴功|粉红奶|泰奶/g;
}

function skeletonKey(sentence: string) {
  return sentence.replace(namedFood(), "X").replace(/[。！？!?\s]/g, "");
}

function namesIn(sentence: string) {
  return [...sentence.matchAll(namedFood())].map((match) => match[0]);
}

function listNames(names: string[]) {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]}和${unique[1]}`;
  return `${unique.slice(0, -1).join("、")}和${unique[unique.length - 1]}`;
}

const REORDER_FRAME = /还会想再点|还会点/;

function stripReorderWords(text: string) {
  return text
    .replace(/是我这次还会想再点的一道/g, "")
    .replace(/是我下次还会想再点的一道/g, "")
    .replace(/这次还会想再点的是/g, "")
    .replace(/下次也还会想再点/g, "")
    .replace(/下次还会想再点/g, "")
    .replace(/这次还会想再点/g, "")
    .replace(/还会想再点/g, "")
    .replace(/还会点/g, "");
}

function judgmentText(sentence: string, name: string) {
  const cleaned = stripReorderWords(sentence.replace(name, ""))
    .replace(/[。！？!?]/g, "")
    .replace(/^[，,、\s]+|[，,、\s]+$/g, "")
    .replace(/^(?:是我|也|都)+/u, "")
    .replace(/(?:也|都)+$/u, "")
    .trim();
  if (!cleaned || /^(?:这次|下次|也|都|是|的是)+$/u.test(cleaned)) return "";
  return cleaned;
}

function parseReorderSentence(sentence: string): { name: string; judgment: string } | "ambiguous" | "skip" {
  if (!REORDER_FRAME.test(sentence)) return "skip";
  const names = namesIn(sentence);
  if (names.length !== 1) return "ambiguous";
  const name = names[0] ?? "";
  if (!name) return "ambiguous";
  return { name, judgment: judgmentText(sentence, name) };
}

function isSingleDishReorder(sentence: string) {
  return REORDER_FRAME.test(sentence) && namesIn(sentence).length === 1;
}

/** Keep each dish's own words. A shared reorder frame can fold; an unclear pairing stays as written. */
function compressReorderRun(sentences: string[]) {
  const parsed = sentences.map(parseReorderSentence);
  if (parsed.some((item) => item === "ambiguous" || item === "skip")) return sentences.map(withEnd).join("");
  const items = parsed as { name: string; judgment: string }[];
  const judgments = items.map((item) => item.judgment);
  if (judgments.every((item) => item === "")) return `这次还会想再点的是${listNames(items.map((item) => item.name))}。`;
  if (judgments.some((item) => item === "")) return sentences.map(withEnd).join("");
  const shared = judgments[0] ?? "";
  if (judgments.every((item) => item === shared) && /^很[^，。]{1,12}$/.test(shared)) {
    return `${listNames(items.map((item) => item.name))}都${shared}，这次还会想再点。`;
  }
  return `${items.map((item) => `${item.name}${item.judgment}`).join("，")}，下次还会想再点。`;
}

function compressSameFrame(sample: string, names: string[], sentences: string[] = []) {
  const run = sentences.length > 0 ? sentences : [sample];
  if (run.some((sentence) => REORDER_FRAME.test(sentence))) return compressReorderRun(run);
  const list = listNames(names);
  if (/吃起来/.test(sample)) return `${list}都吃过。`;
  if (/很好吃|很好喝|也还不错|也值得试试|挺好吃|挺好喝/.test(sample)) return `${list}都尝过。`;
  const predicate = sample
    .replace(namedFood(), "")
    .replace(/[。！？!?]/g, "")
    .replace(/^[，、是\s]+/, "")
    .trim();
  if (!predicate) return `${list}。`;
  return `${list}${predicate}。`;
}

/** Neighboring sentences that share a frame become one sentence. Facts stay, the frame does not repeat. */
export function collapseRepeatedSkeletons(caption: string) {
  const blocks = caption.split(/\n\n+/);
  return blocks
    .map((block) => {
      const sentences = sentencesOf(block);
      const next: string[] = [];
      let index = 0;
      while (index < sentences.length) {
        if (isSingleDishReorder(sentences[index] ?? "")) {
          let end = index + 1;
          while (end < sentences.length && isSingleDishReorder(sentences[end] ?? "")) end += 1;
          const run = sentences.slice(index, end);
          if (run.length >= 2) next.push(compressReorderRun(run));
          else if (run[0]) next.push(run[0]);
          index = end;
          continue;
        }
        const key = skeletonKey(sentences[index] ?? "");
        let end = index + 1;
        while (
          end < sentences.length &&
          key.includes("X") &&
          skeletonKey(sentences[end] ?? "") === key
        ) {
          end += 1;
        }
        const run = sentences.slice(index, end);
        if (run.length >= 2) {
          next.push(compressSameFrame(run[0] ?? "", run.flatMap(namesIn), run));
        } else if (run[0]) next.push(run[0]);
        index = end;
      }
      return next.map(withEnd).filter(Boolean).join("");
    })
    .filter((block) => block.replace(/[。！？!?\s]/g, "").length >= 2)
    .join("\n\n");
}

export function paragraphSentenceCounts(caption: string) {
  return caption
    .split(/\n\n+/)
    .map((block) => sentencesOf(block).length)
    .filter((count) => count > 0);
}

function polishInPlace(caption: string, note: string, evidence: string) {
  return caption
    .split(/\n\n+/)
    .map((block) => {
      const next = dropUnnotedTasteClauses(
        sentencesOf(block)
          .map((sentence) => trimGenericClauses(sentence, note))
          .filter((sentence) => !isUnrequestedStock(sentence, evidence) && !isAddressLine(sentence)),
        note,
      ).map((sentence) => (slotOf(sentence) === "food" ? restoreNotedTastes(sentence, note) : sentence));
      return next.map(withEnd).filter(Boolean).join("");
    })
    .filter((block) => block.replace(/[。！？!?\s]/g, "").length >= 2)
    .join("\n\n");
}

/** A caption that already has paragraphs, a real order, and the customer's reason stays in that order. */
function keepsOwnShape(caption: string, note: string) {
  if (!/\n\n/.test(caption)) return false;
  const counts = paragraphSentenceCounts(caption);
  if (counts.length === 0 || counts.some((count) => count > 3)) return false;
  const arrival = /朋友|同事|听说|约上|终于|之前提过|推荐过来|老婆|老公|一家人|带着一家/;
  if (arrival.test(note) && !arrival.test(caption)) return false;
  return true;
}

/** Put one visit in lived order: arrival, the dish they dwelled on, the rest of the meal, then how it felt. */
export function arrangeDiningStory(caption: string, note = "", evidence = note) {
  const source = evidence || note;
  const finish = (text: string) => stripUnsupportedAdditions(text, source);
  const collapsed = collapseRepeatedSkeletons(caption);
  if (keepsOwnShape(collapsed, note)) return finish(polishInPlace(collapsed, note, source));
  const sentences = sentencesOf(collapsed).flatMap(peel).filter((sentence) => !isAddressLine(sentence));
  if (sentences.length < 2) return finish(dedupeRepeatedFacts(caption.trim()));
  const buckets: Record<Slot, string[]> = { scene: [], food: [], drink: [], feeling: [], close: [] };
  for (const sentence of sentences) {
    const slot = slotOf(sentence);
    if (slot === "scene" && isAddressLine(sentence)) continue;
    buckets[slot].push(sentence);
  }
  const foods = attachFoodDetails(buckets.food);
  const hero = foods[0] ? [foods[0]] : [];
  const sides = foods.slice(1).map(softenSideDish);
  const drinks = buckets.drink.map(completeDrink);
  const ending = [...mergeRoom(buckets.feeling), ...drinks, ...buckets.close];
  const cleaned = sentencesOf(
    dedupeRepeatedFacts(
      [...mergeScenes(buckets.scene.filter((sentence) => !isAddressLine(sentence)), ""), ...hero, ...sides, ...ending].join(""),
    ),
  );
  const kept = cleaned
    .map((sentence) => trimGenericClauses(sentence, note))
    .filter((sentence) => !isUnrequestedStock(sentence, source));
  const scene = kept.filter((sentence) => slotOf(sentence) === "scene");
  const meal = dropUnnotedTasteClauses(
    kept.filter((sentence) => slotOf(sentence) === "food"),
    note,
  ).map((sentence) => restoreNotedTastes(sentence, note));
  const close = kept.filter((sentence) => slotOf(sentence) === "feeling" || slotOf(sentence) === "drink" || slotOf(sentence) === "close");
  return finish(
    [paragraph(scene), paragraph(meal), paragraph(close)]
      .filter((block) => block.replace(/[。！？!?\s]/g, "").length >= 2)
      .join("\n\n"),
  );
}
