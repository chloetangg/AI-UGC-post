import {
  countCoverUnits,
  hasCoverTitleKeyword,
  isCoverKeywordStuffing,
  type CoverTitleContext,
} from "@/lib/cover/cover-rules";
import { isNaturalCoverChinese } from "@/lib/cover/cover-natural";
import { sanitizeCoverLine } from "@/lib/cover/cover-title-text";
import { chineseFullDishName, coverDishShortName } from "@/lib/cover/dish-names";
import type { RecommendedDish } from "@/types/content";
import { detectedPartyKinds, customerPartySource, neutralizeInventedPartyCopy } from "@/lib/party-size";

export type CoverHookType =
  | "personal-experience"
  | "food"
  | "scene"
  | "atmosphere"
  | "discovery";

export type ExperienceFact = {
  id: string;
  kind: "person" | "service" | "atmosphere" | "scene" | "first-visit" | "food" | "price" | "emotion";
  hookType: CoverHookType;
  markers: string[];
  coverMains: string[];
  coverSubs: string[];
  titleHooks: string[];
  captionLine: string;
};

const BANNED_DISCOVERY_COVERS =
  /^(曼谷)?(美食|泰餐)?(发现|推荐|体验)$|曼谷美食发现|曼谷泰餐推荐|曼谷美食推荐|曼谷美食体验|曼谷泰餐发现/;

const DISCOVERY_TITLE_SHELL =
  /美食发现|泰餐推荐|美食推荐|泰餐发现|美食体验|泰餐体验|隐藏泰餐|不知道吃什么|隐藏宝藏|本地人才知道|美食天花板|第一次来曼谷一定要|曼谷今天也太/;

const GENERIC_UNGROUNDED_TITLE =
  /曼谷今天也太|隐藏在曼谷的宝藏|本地人才知道|第一次来曼谷一定要|美食天花板|隐藏宝藏|泰国本地人|曼谷美食天花板/;

const WEAK_SEO_TITLE_ONLY = /^(🇹🇭)?(曼谷)?(美食|泰餐)?(发现|推荐|体验|探店)$/;

const SEO_ONLY_LEFTOVER = /发现|推荐|体验|隐藏|探店|新开|必吃/;

export const CANONICAL_CENTRALWORLD = "centralwOrld";

export function classifyCoverHookType(title: string, subtitle = ""): CoverHookType {
  const hay = `${title}${subtitle}`;
  if ((/老板/.test(hay) || /服务/.test(hay) || /中文菜单|支付宝/.test(hay)) && !isWeakSeoCover(title)) {
    return "personal-experience";
  }
  if (/逛街|逛完|商场|两个人|聊天|路过/.test(hay)) return "scene";
  if (/舒服|放松|温馨|氛围|环境|翻新|面积/.test(hay)) return "atmosphere";
  if (/咖喱|冬阴功|糯米|空心菜|鲈鱼|炒饭|蟹脚|河虾|虾仁|滑蛋|正宗/.test(hay)) return "food";
  if (/发现|推荐|探店|隐藏/.test(hay)) return "discovery";
  return "personal-experience";
}

export function isWeakSeoCover(title: string) {
  const cleaned = sanitizeCoverLine(title);
  if (!cleaned) return true;
  if (BANNED_DISCOVERY_COVERS.test(cleaned)) return true;
  let leftover = cleaned;
  for (const keyword of ["centralwOrld", "曼谷", "泰餐", "美食", "必吃"]) {
    leftover = leftover.split(keyword).join("");
  }
  leftover = leftover.replace(SEO_ONLY_LEFTOVER, "").replace(/\s+/g, "");
  const han = leftover.match(/\p{Script=Han}/gu)?.length ?? 0;
  return han < 2;
}

export function isBannedDiscoveryFallback(title: string) {
  return BANNED_DISCOVERY_COVERS.test(sanitizeCoverLine(title));
}

function noteDeniesService(note: string) {
  return /没有.{0,8}服务|服务不好|服务一般|没有特别的服务/.test(note);
}

function firstDishShort(context: CoverTitleContext) {
  const fromList = (context.dishes ?? []).find((item) => item && item !== "Others");
  if (fromList) return coverDishShortName(chineseFullDishName(fromList as RecommendedDish) || fromList);
  const note = context.diningNote ?? "";
  const fromNote = [
    "咖喱蟹肉",
    "冬阴功",
    "炒空心菜",
    "菠萝炒饭",
    "芒果糯米饭",
    "滑蛋饭",
    "青柠蒸鲈鱼",
    "蒜炒虾仁",
    "酸甜酱炒河虾",
    "青咖喱牛肉",
  ].find((name) => note.includes(name));
  return fromNote ?? "";
}

export function extractExperienceFacts(context: CoverTitleContext = {}): ExperienceFact[] {
  const note = context.diningNote?.trim() ?? "";
  const enjoy = (context.enjoyMost ?? []).join(" ");
  const spoken = `${note} ${enjoy}`.trim();
  const reasons = (context.recommendTo ?? []).join(" ");
  const dishShort = firstDishShort(context);
  const facts: ExperienceFact[] = [];

  const add = (fact: ExperienceFact) => {
    if (facts.some((item) => item.id === fact.id)) return;
    facts.push(fact);
  };

  if (/老板/.test(spoken) && /帅|好看|英俊/.test(spoken)) {
    add({
      id: "handsome-owner",
      kind: "person",
      hookType: "personal-experience",
      markers: ["老板", "帅"],
      coverMains: ["老板很帅的曼谷泰餐", "遇到帅老板", "这家老板好帅", "老板好帅"],
      coverSubs: ["老板本人很有记忆点", "来吃饭被老板帅到了"],
      titleHooks: ["曼谷泰餐遇到帅老板", "这家泰餐老板也太帅了", "来吃饭居然被老板帅到了"],
      captionLine: "这顿还有个记忆点，老板本人真的很有印象。",
    });
  } else if (/老板/.test(spoken) && /亲切|友善|热情|好说话|礼貌/.test(spoken)) {
    add({
      id: "friendly-owner",
      kind: "person",
      hookType: "personal-experience",
      markers: ["老板"],
      coverMains: ["老板很亲切", "遇到好老板"],
      coverSubs: ["老板本人很亲切", "老板给人感觉很自然"],
      titleHooks: ["曼谷泰餐老板很亲切", "这家老板本人很亲切"],
      captionLine: "老板本人很亲切，吃饭时感觉很自然。",
    });
  }

  if (
    !noteDeniesService(note) &&
    (/(服务|服务员).{0,8}(很好|真好|周到|舒服|礼貌|圈粉|到位|热情)/.test(spoken) ||
      /服务也很好|服务很好|服务真的很好|服务很热情/.test(spoken) ||
      /店员服务热情周到/.test(enjoy))
  ) {
    add({
      id: "good-service",
      kind: "service",
      hookType: "personal-experience",
      markers: ["服务"],
      coverMains: ["服务真的很好", "被服务圈粉", "这家服务好舒服"],
      coverSubs: /礼貌/.test(note)
        ? ["服务员很有礼貌", "服务也很舒服"]
        : ["服务也很舒服", "用餐服务很到位", "服务真的很好"],
      titleHooks: ["曼谷吃饭这家服务很舒服", "服务很热情吃泰餐更轻松", "曼谷泰餐被服务圈粉"],
      captionLine: "店员服务很热情，整个用餐过程都让人觉得很舒服。",
    });
  }

  if (/逛完|逛街后|逛街后来|逛完街|逛完商场|逛完central/i.test(spoken)) {
    add({
      id: "mall-stop",
      kind: "scene",
      hookType: "scene",
      markers: ["逛"],
      coverMains: ["逛街后来吃", "逛完刚好来吃"],
      coverSubs: ["逛完街来吃刚刚好", "逛街后吃这顿刚刚好"],
      titleHooks: ["逛街后来吃这顿刚刚好", "曼谷逛街顺便吃饭"],
      captionLine: "逛完街之后刚好过来吃，行程上刚刚好。",
    });
  }

  if (
    /(店里|环境|氛围|坐着|吃饭).{0,8}(舒服|温馨|放松)|很适合聊天|很放松/.test(spoken) ||
    /家庭式温馨|环境很好/.test(enjoy)
  ) {
    add({
      id: "comfortable",
      kind: "atmosphere",
      hookType: "atmosphere",
      markers: ["舒服", "放松", "温馨"],
      coverMains: ["这家吃饭很舒服", "这顿饭很放松"],
      coverSubs: ["店里坐着很舒服", "很适合慢慢吃"],
      titleHooks: ["曼谷吃饭这家很舒服", "曼谷这顿饭很放松"],
      captionLine: "店里坐着很舒服，整个人都放松下来了。",
    });
  }

  if (/第一次/.test(spoken) || /1st time/i.test(context.visitFrequency ?? "")) {
    add({
      id: "first-visit",
      kind: "first-visit",
      hookType: "personal-experience",
      markers: ["第一次"],
      coverMains: ["第一次来尝试", "第一次来吃"],
      coverSubs: ["第一次来尝试Baan Ying", "原本只是想试试看"],
      titleHooks: ["第一次来就被服务圈粉", "第一次来曼谷吃泰餐"],
      captionLine: "第一次来，原本只是想试试看。",
    });
  }

  if (/两个人|两人来|两人吃|两人用餐|两个人约会|二人世界|就我们俩/.test(spoken)) {
    add({
      id: "for-two",
      kind: "scene",
      hookType: "scene",
      markers: ["两"],
      coverMains: ["两个人吃饭刚好"],
      coverSubs: ["两个人吃下来很满足"],
      titleHooks: ["两个人吃饭刚刚好"],
      captionLine: "两个人吃下来很满足。",
    });
  }

  const foodInNote = /很好吃|合口味|很香|很满足|印象很深/.test(note) && /咖喱|冬阴功|糯米|空心菜|鲈鱼|炒饭|蟹|虾|菜/.test(note);
  if (
    dishShort &&
    (foodInNote || (context.dishes?.length ?? 0) > 0 || /食物味道正宗美味/.test(enjoy))
  ) {
    add({
      id: "featured-dish",
      kind: "food",
      hookType: "food",
      markers: [dishShort, ...(reasons ? [reasons.slice(0, 4)] : [])].filter(Boolean),
      coverMains: ["曼谷必吃", dishShort, "这道真香"].filter(Boolean),
      coverSubs: [`这口${dishShort}很香`.slice(0, 20), "吃完还想再点", "这道真的很香"].filter(
        (line) => line.length >= 4,
      ),
      titleHooks: [`曼谷美食｜${dishShort}很合口味`, `曼谷泰餐${dishShort}很满足`],
      captionLine: `${dishShort}也很合口味，这顿整体比预期更轻松。`,
    });
  }

  if (/中文菜单/.test(spoken)) {
    add({
      id: "chinese-menu",
      kind: "service",
      hookType: "personal-experience",
      markers: ["中文菜单"],
      coverMains: ["有中文菜单", "中文菜单方便"],
      coverSubs: ["点餐不用再猜", "中文菜单太方便"],
      titleHooks: ["中文菜单点餐太方便", "有中文菜单吃泰餐更轻松"],
      captionLine: "店里有中文菜单，点菜不会有太大压力。",
    });
  }

  if (/餐厅面积很大|环境很大|面积很大/.test(spoken)) {
    add({
      id: "spacious",
      kind: "atmosphere",
      hookType: "atmosphere",
      markers: ["面积", "环境大", "够大", "很大", "空间"],
      coverMains: ["环境够大", "店里很大"],
      coverSubs: ["坐着不觉得挤", "环境大吃饭也舒服"],
      titleHooks: ["环境够大，吃泰餐很舒服", "这家泰餐环境大，吃饭也舒服"],
      captionLine: "店里的空间比想象中大很多，坐下来吃饭不会觉得挤。",
    });
  }

  if (/在购物商场里的泰餐连锁/.test(enjoy) || /购物商场|在商场里/.test(note)) {
    add({
      id: "mall-chain",
      kind: "scene",
      hookType: "scene",
      markers: ["商场"],
      coverMains: ["商场里吃泰餐", "逛街后来吃"],
      coverSubs: ["商场里吃饭很方便", "逛街后来吃刚刚好"],
      titleHooks: ["centralwOrld逛街顺便吃泰餐", "商场里吃泰餐很方便"],
      captionLine: "在购物商场里吃饭，行程上很方便。",
    });
  }

  if (/刚刚翻新环境很好/.test(enjoy) || /翻新/.test(spoken)) {
    add({
      id: "renovated",
      kind: "atmosphere",
      hookType: "atmosphere",
      markers: ["翻新"],
      coverMains: ["刚刚翻新", "环境刚翻新"],
      coverSubs: ["翻新后环境更好了", "店里刚刚翻新"],
      titleHooks: ["刚刚翻新，环境看着很舒服", "这家泰餐刚刚翻新"],
      captionLine: "店里刚刚翻新，环境看着很舒服。",
    });
  }

  if (/店里菜品选择丰富/.test(enjoy) || /菜品(选择)?很多|选择很多/.test(note)) {
    add({
      id: "variety",
      kind: "food",
      hookType: "food",
      markers: ["菜品", "选择"],
      coverMains: ["菜品选择多", "菜品很丰富"],
      coverSubs: ["想吃的基本都有", "菜品选择很多"],
      titleHooks: ["菜品选择多，点泰餐不纠结", "这家泰餐菜品选择很丰富"],
      captionLine: "店里菜品选择很多，点餐不纠结。",
    });
  }

  if (/支付可以使用支付宝/.test(enjoy) || /支付宝/.test(spoken)) {
    add({
      id: "alipay",
      kind: "service",
      hookType: "personal-experience",
      markers: ["支付宝"],
      coverMains: ["能用支付宝", "支付宝能付"],
      coverSubs: ["结账可以用支付宝", "付款很方便"],
      titleHooks: ["结账能用支付宝，吃泰餐更方便", "这家泰餐可以用支付宝"],
      captionLine: "结账可以用支付宝，付款方便很多。",
    });
  }

  const partyKinds = detectedPartyKinds(customerPartySource(context));
  if (partyKinds.has("family") || partyKinds.has("kids")) {
    add({
      id: "family-friendly",
      kind: "atmosphere",
      hookType: "atmosphere",
      markers: ["家人", "带娃", "小朋友"],
      coverMains: ["曼谷吃什么？", "带家人来吃", "很适合家庭"],
      coverSubs: ["带家人吃饭很舒服", "很适合家庭用餐"],
      titleHooks: ["曼谷吃什么？这家泰餐很适合带娃", "带家人来吃泰餐很舒服"],
      captionLine: "很适合带家人一起吃饭。",
    });
  } else if (partyKinds.has("family-suitable")) {
    add({
      id: "family-suitable",
      kind: "atmosphere",
      hookType: "atmosphere",
      markers: ["家庭用餐"],
      coverMains: ["曼谷吃什么？", "很适合家庭用餐", "氛围很温馨"],
      coverSubs: ["很适合家庭用餐", "氛围也比较温馨"],
      titleHooks: ["曼谷吃什么？这家泰餐很适合带娃", "很适合家庭用餐"],
      captionLine: "很适合家庭用餐，氛围也比较放松。",
    });
  }

  if (/食物味道正宗美味/.test(enjoy) || /味道正宗|食物正宗|口味正宗/.test(spoken)) {
    add({
      id: "authentic-taste",
      kind: "food",
      hookType: "food",
      markers: ["正宗"],
      coverMains: ["味道很正宗", "泰餐很正宗"],
      coverSubs: ["味道吃着很正宗", "这顿味道很正"],
      titleHooks: ["这家泰餐味道很正宗", "食物味道正宗，吃着很满足"],
      captionLine: "食物整体味道很正宗，吃起来就是很熟悉的泰式风味。",
    });
  }

  if (/新鲜度/.test(spoken) && /提升空间|一般|不够新鲜/.test(spoken)) {
    add({
      id: "freshness-room",
      kind: "food",
      hookType: "food",
      markers: ["新鲜"],
      coverMains: ["新鲜度一般", "食材一般"],
      coverSubs: ["新鲜度还有提升空间", "食材新鲜度一般"],
      titleHooks: ["食材新鲜度还有提升空间"],
      captionLine: "感觉食材的新鲜度还有一点提升空间。",
    });
  }

  return facts;
}

function tryCoverMain(hook: string) {
  const cleaned = sanitizeCoverLine(hook);
  const candidates = [
    cleaned,
    `曼谷泰餐${cleaned}`,
    `${cleaned}的曼谷泰餐`,
    `泰餐${cleaned}`,
    cleaned.replace(/^这家/, "曼谷"),
    `曼谷${cleaned}`,
    `美食${cleaned}`,
  ];
  for (const raw of candidates) {
    const line = sanitizeCoverLine(raw);
    const units = countCoverUnits(line);
    if (
      units >= 4 &&
      units <= 10 &&
      hasCoverTitleKeyword(line) &&
      !isCoverKeywordStuffing(line) &&
      isNaturalCoverChinese(line)
    ) {
      return line;
    }
  }
  return "";
}

function tryCoverSub(line: string) {
  const cleaned = sanitizeCoverLine(line);
  const units = countCoverUnits(cleaned);
  if (units >= 6 && units <= 10) return cleaned;
  return "";
}

export function evidenceLedCoverPairs(context: CoverTitleContext = {}) {
  const facts = extractExperienceFacts(context);
  const previousType = context.previousCoverHookType || classifyCoverHookType(context.previousCoverTitle ?? "");
  const pairs: Array<{ title: string; subtitle: string; hookType: CoverHookType }> = [];

  for (let index = 0; index < facts.length; index += 1) {
    const primary = facts[index];
    const secondary = facts[(index + 1) % facts.length];
    if (previousType && primary.hookType === previousType && facts.length > 1 && previousType === "discovery") {
      continue;
    }
    if (previousType === "discovery" && primary.hookType === "discovery") continue;
    if (previousType === "food" && primary.hookType === "food" && facts.some((item) => item.hookType !== "food")) {
      continue;
    }
    for (const mainHook of primary.coverMains) {
      const title = tryCoverMain(mainHook);
      if (!title) continue;
      const subSource = secondary && secondary.id !== primary.id ? secondary.coverSubs : primary.coverSubs;
      for (const subHook of subSource) {
        const subtitle = tryCoverSub(subHook);
        if (!subtitle) continue;
        if (title.includes(sanitizeCoverLine(subHook).slice(0, 4))) continue;
        pairs.push({ title, subtitle, hookType: primary.hookType });
      }
    }
  }

  return pairs;
}

function textHasFact(text: string, fact: ExperienceFact) {
  return fact.markers.some((marker) => marker && text.includes(marker));
}

function layersWithFacts(
  titles: string[],
  caption: string,
  coverTitle: string,
  coverSubtitle: string,
  facts: ExperienceFact[],
) {
  if (facts.length === 0) return 3;
  const titleHit = titles.some((title) => facts.some((fact) => textHasFact(title, fact)));
  const captionHit = facts.some((fact) => textHasFact(caption, fact));
  const coverHit = facts.some((fact) => textHasFact(`${coverTitle}${coverSubtitle}`, fact));
  return [titleHit, captionHit, coverHit].filter(Boolean).length;
}

export function isLowDiversityDiscoveryTitles(titles: string[]) {
  const hits = titles.filter(
    (title) =>
      (DISCOVERY_TITLE_SHELL.test(title) || GENERIC_UNGROUNDED_TITLE.test(title)) &&
      !/老板|服务|逛街|舒服|咖喱|冬阴功|第一次|中文菜单|支付宝|翻新|面积/.test(title),
  );
  return hits.length >= 2;
}

function injectFactIntoCaption(caption: string, fact: ExperienceFact) {
  if (textHasFact(caption, fact)) return caption;
  const match = caption.match(/[。！？!?]/);
  const at = match && match.index !== undefined ? match.index + 1 : Math.min(caption.length, 24);
  const insert = fact.captionLine.endsWith("。") ? fact.captionLine : `${fact.captionLine}。`;
  return `${caption.slice(0, at)}${insert}${caption.slice(at)}`;
}

function rewriteDiscoveryTitles(
  titles: [string, string, string],
  facts: ExperienceFact[],
  context: CoverTitleContext = {},
): [string, string, string] {
  const next: [string, string, string] = [titles[0], titles[1], titles[2]];
  const hooks = usableTitleHooks(facts, context);
  if (hooks.length === 0) return next;
  let hookIndex = 0;
  for (let index = 0; index < next.length; index += 1) {
    const title = next[index];
    if (!DISCOVERY_TITLE_SHELL.test(title)) continue;
    const hook = hooks[hookIndex % hooks.length] ?? hooks[0];
    hookIndex += 1;
    const keepFlag = title.trimStart().startsWith("🇹🇭");
    next[index] = `${keepFlag ? "🇹🇭" : ""}${hook}`;
  }
  return next;
}

export function previousPrimaryExperienceId(context: CoverTitleContext = {}, previousTitles: string[] = []) {
  const facts = extractExperienceFacts(context);
  const hay = `${context.previousCoverTitle ?? ""} ${previousTitles.join(" ")}`;
  return facts.find((fact) => textHasFact(hay, fact))?.id ?? "";
}

export function formatEvidencePriorityRules(context: CoverTitleContext = {}, previousTitles: string[] = []) {
  const facts = extractExperienceFacts(context);
  const previousHook = context.previousCoverHookType || classifyCoverHookType(context.previousCoverTitle ?? "");
  const previousPrimary = context.previousPrimaryExperience || previousPrimaryExperienceId(context, previousTitles);
  const primary = facts.find((fact) => fact.id !== previousPrimary) ?? facts[0];
  const secondary = facts.find((fact) => fact.id !== primary?.id);
  const food = facts.find((fact) => fact.kind === "food");
  const allowedMaterial = facts.length
    ? facts.map((fact) => `${fact.id}: ${fact.markers.join("/")}`).join("; ")
    : "confirmed dining location centralwOrld + selected dishes/reasons only";
  return `EVIDENCE PRIORITY — do this internally before writing JSON. Do not print this block.

CUSTOMER INPUT → EXTRACT REAL FACTS → PICK THE MOST ATTRACTIVE TRUE FACTS → WRITE TITLE / COVER TITLE / COVER SUBTITLE.

Never write a generic Xiaohongshu title first and then look for a reason. Facts first, then wording.

TITLE / COVER MATERIAL PRIORITY
Priority 1 — customer-written experience, feelings, review points, recommend reasons (dining note + custom other text).
Priority 2 — customer-selected restaurant highlights / enjoy-most tags.
Priority 3 — customer-selected dishes and their real recommend reasons.
Priority 4 — confirmed restaurant facts only, e.g. dining location centralwOrld, confirmed menu/payment/atmosphere already in the system.
Do not invent an experience, like, selling point, scene, price, promo, or “必吃/隐藏宝藏” conclusion that is not in the input.

ALLOWED TITLE MATERIAL THIS VISIT: ${allowedMaterial}

USER DETAIL PRESERVATION: 老板很帅 ≠ 店员很亲切. 服务很好 ≠ 环境很好. 老板很亲切 ≠ 店里很温馨. You may rewrite the wording, not the fact. Do not invent a boss, service, atmosphere, or emotion the customer did not write.

centralwOrld RULE — Title 1 + Title 2 + Title 3 + Cover Title + Cover Subtitle must contain the exact token "centralwOrld" at least once. Only this spelling counts. Never CentralWorld / Centralworld / centralworld / Central World / central world / 尚泰世界 as a substitute. Weave it naturally in ONE place only. Do not repeat it. Do not stuff it. If a title already has a customer fact, prefer weaving into that line (e.g. centralwOrld逛街顺便吃泰餐) rather than a separate keyword dump.

Forbidden unless the customer or confirmed data actually said it: 曼谷今天也太好吃了 / 隐藏在曼谷的宝藏餐厅 / 泰国本地人才知道的美食 / 第一次来曼谷一定要吃 / 曼谷美食天花板 / 隐藏宝藏 / 美食天花板.
PARTY SIZE: mention 两个人 / 家人 / 朋友 / 小孩 / 一个人 only when the customer explicitly wrote that. Never infer from spend, dish count, photos, or tourist/local. If unknown, write 这次来吃 / 这顿吃下来.

CONTENT ALLOCATION — same visit, different jobs. Do not paste the same sentence into title + caption + cover.
TITLE = one hook from real input. CAPTION = the full true story. COVER = the shortest memorable line from the same real facts.
If the note is 老板很帅，服务很好: Title may use 老板, Caption may use 服务, Cover may use 遇到帅老板. Do not put 老板很帅 in all three.

THIS VISIT INTERNAL BRIEF:
PRIMARY EXPERIENCE: ${primary ? `${primary.id} (${primary.coverMains[0]})` : "none — use food/scene from selected answers"}
SECONDARY EXPERIENCE: ${secondary ? `${secondary.id} (${secondary.coverMains[0]})` : "none"}
FOOD / DISH ANGLE: ${food ? food.coverMains[0] : firstDishShort(context) || "none"}
SEARCH KEYWORD: SEO only, weave in, do not become the headline topic. Real customer facts > generic keywords > AI flourish.

TITLE ANGLES (must be obviously different, all from real facts):
1 = location + dining, or personal experience from PRIMARY
2 = a different customer experience / enjoy-most highlight
3 = restaurant trait / dish / scene from real input
Not the same sentence with swapped adjectives. Do not add unrelated details just to look different.
Forbidden trio: 曼谷美食发现 / 曼谷美食推荐 / 曼谷泰餐推荐

COVER HOOK TYPE this round: prefer ${
    previousHook === "discovery"
      ? "Personal Experience / Food / Scene / Atmosphere — avoid Discovery"
      : previousHook === "food"
        ? "Personal Experience / Scene / Atmosphere — avoid another Food-only cover"
        : "Personal Experience first if Priority 1 exists, else Food / Scene / Atmosphere. Discovery is allowed only as one of many, never the default."
  }
Previous cover hook type: ${previousHook || "none"}
Previous primary experience: ${previousPrimary || "none"}
Previous title angle: ${context.previousTitleAngle || "none"}
Do not default to 曼谷美食发现 / 曼谷泰餐推荐 / 曼谷美食推荐. If validation fails, rebuild from PRIMARY EXPERIENCE + one pool keyword, e.g. 曼谷泰餐遇到帅老板, never 曼谷+美食+发现.

COVER keyword rule: must naturally contain at least one of 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃, BUT the keyword must not be the main content. USER EXPERIENCE > specific food/scene > search keyword.`;
}

export function ensureEvidenceLedCopy(input: {
  titles: [string, string, string];
  caption: string;
  coverTitle: string;
  coverSubtitle: string;
  context?: CoverTitleContext;
  previousTitles?: string[];
}) {
  const context = input.context ?? {};
  const facts = extractExperienceFacts(context);
  const previousType = context.previousCoverHookType || classifyCoverHookType(context.previousCoverTitle ?? "");
  let titles: [string, string, string] = [...input.titles];
  let caption = input.caption;
  let coverTitle = input.coverTitle;
  let coverSubtitle = input.coverSubtitle;

  const evidencePairs = evidenceLedCoverPairs({
    ...context,
    previousCoverHookType: previousType,
  });
  const preferred = evidencePairs[0];
  const coverIsWeak =
    isWeakSeoCover(coverTitle) ||
    (previousType === "discovery" && classifyCoverHookType(coverTitle, coverSubtitle) === "discovery");

  if (preferred && (coverIsWeak || (facts.length > 0 && layersWithFacts(titles, caption, coverTitle, coverSubtitle, facts) < 2))) {
    coverTitle = preferred.title;
    coverSubtitle = preferred.subtitle;
  }

  if (facts.length > 0 && layersWithFacts(titles, caption, coverTitle, coverSubtitle, facts) < 2) {
    const primary = facts[0];
    if (!textHasFact(caption, primary)) caption = injectFactIntoCaption(caption, primary);
    if (!titles.some((title) => textHasFact(title, primary))) {
      const hook = primary.titleHooks[0] ?? tryCoverMain(primary.coverMains[0]);
      if (hook) titles[0] = titles[0].trimStart().startsWith("🇹🇭") ? `🇹🇭${hook}` : hook;
    }
  }

  if (isLowDiversityDiscoveryTitles(titles) && facts.length > 0) {
    titles = rewriteDiscoveryTitles(titles, facts, context);
  }

  return {
    titles: [
      neutralizeInventedPartyCopy(titles[0], context),
      neutralizeInventedPartyCopy(titles[1], context),
      neutralizeInventedPartyCopy(titles[2], context),
    ] as [string, string, string],
    caption: neutralizeInventedPartyCopy(caption, context),
    coverTitle: neutralizeInventedPartyCopy(coverTitle, context),
    coverSubtitle: neutralizeInventedPartyCopy(coverSubtitle, context),
  };
}

const ENJOY_MARKERS: Record<string, string[]> = {
  有中文菜单: ["中文菜单"],
  餐厅面积很大: ["面积", "环境大"],
  在购物商场里的泰餐连锁: ["商场", "逛街"],
  刚刚翻新环境很好: ["翻新"],
  店员服务热情周到: ["服务", "热情"],
  店里菜品选择丰富: ["菜品", "选择"],
  食物味道正宗美味: ["正宗"],
  餐厅风格有满满的家庭式温馨氛围: ["温馨"],
  支付可以使用支付宝: ["支付宝"],
};

const NOTE_MARKERS = [
  "老板",
  "帅",
  "服务",
  "中文菜单",
  "支付宝",
  "逛",
  "舒服",
  "温馨",
  "第一次",
  "正宗",
  "翻新",
  "家人",
] as const;

export function normalizeExactCentralworld(text: string) {
  return text.replace(/central\s*world/gi, CANONICAL_CENTRALWORLD);
}

export function copyMentionsExactCentralworld(fields: string[]) {
  return fields.some((field) => field.includes(CANONICAL_CENTRALWORLD));
}

function hasMallEvidence(context: CoverTitleContext) {
  const enjoy = (context.enjoyMost ?? []).join(" ");
  const note = context.diningNote ?? "";
  return /在购物商场里的泰餐连锁/.test(enjoy) || /逛|商场/.test(note);
}

function collectGroundingMarkers(context: CoverTitleContext, facts: ExperienceFact[]) {
  const markers = new Set<string>();
  for (const fact of facts) {
    for (const marker of fact.markers) {
      if (marker.length >= 2) markers.add(marker);
    }
  }
  for (const tag of context.enjoyMost ?? []) {
    const aliases = ENJOY_MARKERS[tag];
    if (aliases) {
      for (const alias of aliases) markers.add(alias);
    } else if (tag && tag !== "其他" && tag.length >= 2) {
      markers.add(tag.slice(0, 6));
    }
  }
  for (const dish of context.dishes ?? []) {
    if (!dish || dish === "Others") continue;
    const short = coverDishShortName(chineseFullDishName(dish as RecommendedDish) || dish);
    if (short) markers.add(short);
  }
  for (const reason of context.recommendTo ?? []) {
    if (reason && reason !== "其他" && reason.length >= 2) markers.add(reason.slice(0, 4));
  }
  const note = context.diningNote ?? "";
  for (const token of NOTE_MARKERS) {
    if (note.includes(token)) markers.add(token);
  }
  return [...markers];
}

function isGroundedHeadline(text: string, markers: string[], facts: ExperienceFact[]) {
  const cleaned = text.replace(/🇹🇭/g, "");
  if (!cleaned.trim()) return false;
  if (GENERIC_UNGROUNDED_TITLE.test(cleaned)) return false;
  if (WEAK_SEO_TITLE_ONLY.test(cleaned.replace(/\s+/g, ""))) return false;
  if (DISCOVERY_TITLE_SHELL.test(cleaned) && !markers.some((marker) => cleaned.includes(marker))) {
    return false;
  }
  if (facts.some((fact) => textHasFact(cleaned, fact))) return true;
  return markers.some((marker) => marker.length >= 2 && cleaned.includes(marker));
}

function usableTitleHooks(facts: ExperienceFact[], context: CoverTitleContext) {
  const allowFirst = facts.some((fact) => fact.id === "first-visit");
  const allowMall = hasMallEvidence(context);
  const allowed = (hook: string) => {
    if (/第一次/.test(hook) && !allowFirst) return false;
    if (/逛街|逛完/.test(hook) && !allowMall) return false;
    return Boolean(hook);
  };
  const primary: string[] = [];
  const rest: string[] = [];
  for (const fact of facts) {
    const usable = fact.titleHooks.filter(allowed);
    if (usable[0] && !primary.includes(usable[0])) primary.push(usable[0]);
    for (const hook of usable.slice(1)) {
      if (!primary.includes(hook) && !rest.includes(hook)) rest.push(hook);
    }
  }
  return [...primary, ...rest];
}

function keepLeadingFlag(original: string, next: string) {
  if (original.trimStart().startsWith("🇹🇭") && !next.startsWith("🇹🇭")) return `🇹🇭${next}`;
  return next;
}

function rewriteUngroundedTitles(
  titles: [string, string, string],
  facts: ExperienceFact[],
  markers: string[],
  context: CoverTitleContext,
): [string, string, string] {
  const hooks = usableTitleHooks(facts, context);
  if (hooks.length === 0) return titles;
  const next: [string, string, string] = [titles[0], titles[1], titles[2]];
  let hookIndex = 0;
  const used = new Set<string>();
  for (let index = 0; index < next.length; index += 1) {
    if (isGroundedHeadline(next[index], markers, facts)) continue;
    let hook = hooks[hookIndex % hooks.length] ?? hooks[0];
    hookIndex += 1;
    if (used.has(hook) && hooks.length > 1) {
      hook = hooks[hookIndex % hooks.length] ?? hook;
      hookIndex += 1;
    }
    used.add(hook);
    next[index] = keepLeadingFlag(next[index], hook);
  }
  return next;
}

function weaveCentralworld(title: string, context: CoverTitleContext) {
  const text = normalizeExactCentralworld(title);
  if (text.includes(CANONICAL_CENTRALWORLD)) return text;
  const mall = hasMallEvidence(context);
  const flag = text.startsWith("🇹🇭") ? "🇹🇭" : "";
  const body = text.replace(/^🇹🇭/, "");

  if (mall && /逛街/.test(body)) return `${flag}${body.replace("逛街", `${CANONICAL_CENTRALWORLD}逛街`)}`;
  if (mall && /逛完/.test(body)) return `${flag}${body.replace("逛完", `${CANONICAL_CENTRALWORLD}逛完`)}`;
  if (mall && /商场/.test(body)) return `${flag}${body.replace("商场", `${CANONICAL_CENTRALWORLD}商场`)}`;
  if (body.includes("，")) {
    const at = body.indexOf("，");
    return `${flag}${body.slice(0, at + 1)}${CANONICAL_CENTRALWORLD}${body.slice(at + 1)}`;
  }
  if (body.includes("｜")) {
    const at = body.indexOf("｜");
    return `${flag}${body.slice(0, at + 1)}${CANONICAL_CENTRALWORLD}${body.slice(at + 1)}`;
  }
  return `${flag}${CANONICAL_CENTRALWORLD}${body}`;
}

function naturalCentralworldTitle(
  title: string,
  context: CoverTitleContext,
  facts: ExperienceFact[],
) {
  const current = normalizeExactCentralworld(title);
  if (current.includes(CANONICAL_CENTRALWORLD)) return current;
  if (/逛|商场/.test(current) || isGroundedHeadline(current, collectGroundingMarkers(context, facts), facts)) {
    return weaveCentralworld(current, context);
  }
  const mall = hasMallEvidence(context);
  const flag = current.trimStart().startsWith("🇹🇭") ? "🇹🇭" : "";
  const enjoy = (context.enjoyMost ?? []).join(" ");
  const note = context.diningNote ?? "";
  if (mall && /中文菜单/.test(`${enjoy} ${note}`)) {
    return `${flag}centralwOrld逛街吃泰餐，中文菜单太方便`;
  }
  if (mall) return `${flag}centralwOrld逛街顺便吃泰餐`;
  const hook = facts[0]?.titleHooks[0] ?? "";
  if (hook) return keepLeadingFlag(current, `${CANONICAL_CENTRALWORLD}${hook.replace(/^曼谷/, "")}`);
  return weaveCentralworld(current, context);
}

function pickCentralworldTitleIndex(titles: [string, string, string]) {
  const mallIndex = titles.findIndex((title) => /逛|商场/.test(title));
  if (mallIndex >= 0) return mallIndex;
  return 2;
}

export function ensureGroundedHeadlineCopy(input: {
  titles: [string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  context?: CoverTitleContext;
}) {
  const context = input.context ?? {};
  const facts = extractExperienceFacts(context);
  const markers = collectGroundingMarkers(context, facts);
  let titles: [string, string, string] = [
    normalizeExactCentralworld(input.titles[0]),
    normalizeExactCentralworld(input.titles[1]),
    normalizeExactCentralworld(input.titles[2]),
  ];
  let coverTitle = normalizeExactCentralworld(input.coverTitle);
  let coverSubtitle = normalizeExactCentralworld(input.coverSubtitle);

  titles = rewriteUngroundedTitles(titles, facts, markers, context);

  if (!isGroundedHeadline(coverTitle, markers, facts) && facts.length > 0) {
    const pair = evidenceLedCoverPairs(context)[0];
    if (pair) {
      coverTitle = pair.title;
      if (!isGroundedHeadline(coverSubtitle, markers, facts)) coverSubtitle = pair.subtitle;
    }
  } else if (!isGroundedHeadline(coverSubtitle, markers, facts) && facts.length > 0) {
    const pair = evidenceLedCoverPairs(context)[0];
    if (pair?.subtitle) coverSubtitle = pair.subtitle;
  }

  if (!copyMentionsExactCentralworld([...titles, coverTitle, coverSubtitle])) {
    const index = pickCentralworldTitleIndex(titles);
    titles[index] = naturalCentralworldTitle(titles[index], context, facts);
  }

  return {
    titles: [
      neutralizeInventedPartyCopy(titles[0], context),
      neutralizeInventedPartyCopy(titles[1], context),
      neutralizeInventedPartyCopy(titles[2], context),
    ] as [string, string, string],
    coverTitle: neutralizeInventedPartyCopy(coverTitle, context),
    coverSubtitle: neutralizeInventedPartyCopy(coverSubtitle, context),
  };
}
