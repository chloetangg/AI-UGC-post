import {
  countCoverUnits,
  hasCoverTitleKeyword,
  isCoverKeywordStuffing,
  type CoverTitleContext,
} from "@/lib/cover/cover-rules";
import { sanitizeCoverLine } from "@/lib/cover/cover-title-text";
import { chineseFullDishName, coverDishShortName } from "@/lib/cover/dish-names";
import type { RecommendedDish } from "@/types/content";

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
  /美食发现|泰餐推荐|美食推荐|泰餐发现|美食体验|泰餐体验|隐藏泰餐|不知道吃什么/;

const SEO_ONLY_LEFTOVER = /发现|推荐|体验|隐藏|探店|新开|必吃/;

export function classifyCoverHookType(title: string, subtitle = ""): CoverHookType {
  const hay = `${title}${subtitle}`;
  if ((/老板/.test(hay) || /服务/.test(hay)) && !isWeakSeoCover(title)) return "personal-experience";
  if (/逛街|逛完|商场|两个人|聊天|路过/.test(hay)) return "scene";
  if (/舒服|放松|温馨|氛围|环境/.test(hay)) return "atmosphere";
  if (/咖喱|冬阴功|糯米|空心菜|鲈鱼|炒饭|蟹脚|河虾|虾仁/.test(hay)) return "food";
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
    "蟹肉咖喱",
    "冬阴功",
    "炒空心菜",
    "菠萝炒饭",
    "芒果糯米饭",
    "虾仁滑蛋饭",
    "柠檬鲈鱼",
    "咖喱蟹脚",
    "酸甜酱炒河虾",
    "青咖喱牛肉",
  ].find((name) => note.includes(name));
  return fromNote ?? "";
}

export function extractExperienceFacts(context: CoverTitleContext = {}): ExperienceFact[] {
  const note = context.diningNote?.trim() ?? "";
  const enjoy = (context.enjoyMost ?? []).join(" ");
  const reasons = (context.recommendTo ?? []).join(" ");
  const dishShort = firstDishShort(context);
  const facts: ExperienceFact[] = [];

  const add = (fact: ExperienceFact) => {
    if (facts.some((item) => item.id === fact.id)) return;
    facts.push(fact);
  };

  if (/老板/.test(note) && /帅|好看|英俊/.test(note)) {
    add({
      id: "handsome-owner",
      kind: "person",
      hookType: "personal-experience",
      markers: ["老板", "帅"],
      coverMains: ["遇到帅老板", "这家老板好帅", "老板好帅"],
      coverSubs: ["老板本人很有记忆点", "来吃饭被老板帅到了"],
      titleHooks: ["曼谷泰餐遇到帅老板", "这家泰餐老板也太帅了", "来吃饭居然被老板帅到了"],
      captionLine: "这顿还有个记忆点，老板本人真的很有印象。",
    });
  } else if (/老板/.test(note) && /亲切|友善|热情|好说话|礼貌/.test(note)) {
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
    (/(服务|服务员).{0,8}(很好|真好|周到|舒服|礼貌|圈粉|到位)/.test(note) ||
      /服务也很好|服务很好|服务真的很好/.test(note) ||
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
      titleHooks: ["曼谷吃饭这家服务很舒服", "第一次来就被服务圈粉", "曼谷泰餐被服务圈粉"],
      captionLine: "而且服务真的很好，整个吃饭过程都很舒服。",
    });
  }

  if (/逛完|逛街后|逛街后来|逛完街|逛完商场|逛完central/i.test(note)) {
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

  if (/(店里|环境|氛围|坐着|吃饭).{0,8}(舒服|温馨|放松)|很适合聊天|很放松/.test(note) || /家庭式温馨|环境很好/.test(enjoy)) {
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

  if (/第一次/.test(note) || /1st time/i.test(context.visitFrequency ?? "")) {
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

  if (/两个人|两人吃/.test(note)) {
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
      coverMains: [dishShort, "超爱这道", "这道真香"].filter(Boolean),
      coverSubs: [`这口${dishShort}很香`.slice(0, 20), "吃完还想再点", "这道真的很香"].filter(
        (line) => line.length >= 4,
      ),
      titleHooks: [`曼谷美食｜${dishShort}很合口味`, `曼谷泰餐${dishShort}很满足`],
      captionLine: `${dishShort}也很合口味，这顿整体比预期更轻松。`,
    });
  }

  return facts;
}

function tryCoverMain(hook: string) {
  const cleaned = sanitizeCoverLine(hook);
  const candidates = [
    cleaned,
    `曼谷${cleaned}`,
    `泰餐${cleaned}`,
    `曼谷泰餐${cleaned}`,
    `美食${cleaned}`,
    cleaned.replace(/^这家/, "曼谷"),
  ];
  for (const raw of candidates) {
    const line = sanitizeCoverLine(raw);
    const units = countCoverUnits(line);
    if (
      units >= 4 &&
      units <= 7 &&
      hasCoverTitleKeyword(line) &&
      !isCoverKeywordStuffing(line) &&
      !isBannedDiscoveryFallback(line)
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
  const hits = titles.filter((title) => DISCOVERY_TITLE_SHELL.test(title) && !/老板|服务|逛街|舒服|咖喱|冬阴功|第一次/.test(title));
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
): [string, string, string] {
  const next: [string, string, string] = [titles[0], titles[1], titles[2]];
  const hooks = facts.map((fact) => fact.titleHooks[0]).filter(Boolean);
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
  return `EVIDENCE PRIORITY — do this internally before writing JSON. Do not print this block.

CUSTOMER INPUT → PERSONAL EXPERIENCE EXTRACTION → UNIQUE DETAILS → CONTENT PRIORITY → TITLE / CAPTION / COVER.

Priority 1 — diningExperienceNote specific lived details (highest). If the customer wrote 老板很帅 / 服务很好 / 店里很舒服 / 逛完街来吃 / 第一次来, KEEP that fact. Do not generalize it into 曼谷美食发现.
Priority 2 — enjoy-most / recommended dishes / recommend reasons. Use as core only when Priority 1 is thin. Do not always turn the post into a dish-recommendation post.
Priority 3 — tourist/local, first visit, origin, spend, photos. Supporting only.
Priority 4 — brand / KSP / Storyline / selectedSearchKeyword. Search keyword is an SEO layer, NOT the topic. Weave one keyword into a title/cover naturally. Never let Search Keyword decide what the post is about.

USER DETAIL PRESERVATION: 老板很帅 ≠ 店员很亲切. 服务很好 ≠ 环境很好. 老板很亲切 ≠ 店里很温馨. You may rewrite the wording, not the fact. Do not invent a boss, service, atmosphere, or emotion the customer did not write.

CONTENT ALLOCATION — same visit, different jobs. Do not paste the same sentence into title + caption + cover.
TITLE = one hook. CAPTION = the full true story. COVER = the shortest memorable line.
If the note is 老板很帅，服务很好: Title may use 老板, Caption may use 服务, Cover may use 遇到帅老板. Do not put 老板很帅 in all three.

THIS VISIT INTERNAL BRIEF:
PRIMARY EXPERIENCE: ${primary ? `${primary.id} (${primary.coverMains[0]})` : "none — use food/scene from selected answers"}
SECONDARY EXPERIENCE: ${secondary ? `${secondary.id} (${secondary.coverMains[0]})` : "none"}
FOOD / DISH ANGLE: ${food ? food.coverMains[0] : firstDishShort(context) || "none"}
SEARCH KEYWORD: SEO only, weave in, do not become the headline topic.

TITLE ANGLES (must be obviously different):
1 = Personal experience from PRIMARY
2 = Food / dish if a real dish exists, otherwise another lived detail
3 = Scene / atmosphere / first-visit — Discovery only if no stronger evidence
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
    titles = rewriteDiscoveryTitles(titles, facts);
  }

  return { titles, caption, coverTitle, coverSubtitle };
}
