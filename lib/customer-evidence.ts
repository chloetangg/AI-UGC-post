import { arrangeDiningStory } from "@/lib/caption-story";
import { headlineNeedsEvidenceReplacement } from "@/lib/content-evidence";
import { chineseFullDishName } from "@/lib/cover/dish-names";
import { isAcceptableCoverOverlay } from "@/lib/cover/cover-title";
import { selectedCoverLocation, type CoverTitleContext } from "@/lib/cover/cover-rules";
import { keywordInTitle } from "@/lib/title-keywords";
import { isCopiedCustomerLine } from "@/lib/title-insight";
import { parseReviewIntoEvaluationUnits } from "@/lib/cover/subtitle-units";

export type CustomerEvidenceCategory =
  | "CUSTOMER_FOOD"
  | "CUSTOMER_DRINK"
  | "CUSTOMER_FLAVOR"
  | "CUSTOMER_SERVICE"
  | "CUSTOMER_PERSON"
  | "CUSTOMER_ATMOSPHERE"
  | "CUSTOMER_SCENE"
  | "CUSTOMER_FEELING"
  | "CUSTOMER_EXPERIENCE";

type EvidenceSource = "customer" | "other";

type EvidencePoint = {
  source: EvidenceSource;
  category: CustomerEvidenceCategory | "OTHER_DISH" | "OTHER_PLACE";
  text: string;
  entity: string;
  titleHook: string;
  captionLine: string;
  coverLine: string;
  priority: number;
};

const DRINK_NAME = /粉红奶|泰奶|珍珠奶茶|柠檬茶|咖啡|果汁|椰汁|[\p{Script=Han}]{1,4}奶/u;
const EXTRA_TASTE = /香甜|浓郁|清爽|冰凉|冰冰|奶香|解暑|清甜|顺滑/;
const GENERIC_DRINK = /泰式饮品|特色饮品|店里的饮品|这里的饮料|店里的饮料|饮品|饮料/g;

function clauses(note: string) {
  const parts = note
    .split(/[。！？!?\n；;，,、]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return parts.flatMap((part) => {
    const units = parseReviewIntoEvaluationUnits(part);
    return units.length > 1 ? units : [part];
  });
}

function bareVisit(clause: string) {
  const rest = clause
    .replace(/今天|这次|刚刚|来了|去了|来|去|吃饭|用餐|一家|餐厅|Baan Ying|baan ying/gi, "")
    .replace(/\s/g, "");
  return rest.length < 2;
}

function drinkEntity(clause: string) {
  const named = clause.match(/粉红奶|泰奶|珍珠奶茶|柠檬茶|咖啡|果汁|椰汁/);
  if (named) return named[0];
  const milk = clause.match(/[\p{Script=Han}]{1,4}奶/u)?.[0] ?? "";
  if (milk && milk !== "奶奶" && !/饮品|饮料/.test(milk)) return milk;
  return "";
}

function pushUnique(list: EvidencePoint[], point: EvidencePoint | null) {
  if (!point?.entity) return;
  if (list.some((item) => item.entity === point.entity && item.category === point.category)) return;
  list.push(point);
}

function placeName(branch?: string) {
  return selectedCoverLocation(branch) || "centralwOrld";
}

function mentionsPlace(clause: string, mall: string) {
  if (/central/i.test(mall)) return /central\s*world|尚泰世界/.test(clause);
  return new RegExp(mall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(clause);
}

function faithfulDishLine(dish: string, clause: string) {
  const text = clause.replace(/[。！？!?\s]+$/g, "");
  if (/新鲜/.test(text)) {
    if (text.includes("的芒果很新鲜")) return `${text.includes(dish) ? text : `${dish}的芒果很新鲜`}。`;
    if (text.includes("芒果很新鲜")) return `${dish}的芒果很新鲜。`;
    return `${dish}很新鲜。`;
  }
  if (/配料/.test(text)) return `${dish}配料很足。`;
  if (/下饭/.test(text)) return `${dish}很下饭。`;
  if (/Q弹/.test(text)) return `${dish}很Q弹。`;
  if (/蒜香/.test(text)) return `${dish}蒜香很足。`;
  if (/好吃/.test(text)) return `${dish}真的很好吃。`;
  return `${text}。`;
}

function fromClause(clause: string, mall = "centralwOrld"): EvidencePoint | null {
  if (!clause || bareVisit(clause)) return null;
  const drink = drinkEntity(clause);
  if (drink && /好|喜欢|推荐|惊喜|不错/.test(clause)) {
    return {
      source: "customer",
      category: "CUSTOMER_DRINK",
      text: clause,
      entity: drink,
      titleHook: `${drink}真的很好喝`,
      captionLine: `${drink}真的很好喝。`,
      coverLine: `${drink}真的很好喝`,
      priority: 1,
    };
  }
  if (/老板娘|老板/.test(clause) && /帅|好看|漂亮/.test(clause)) {
    const entity = clause.includes("老板娘") ? "老板娘" : "老板";
    const trait = /漂亮/.test(clause) ? "很漂亮" : "很帅";
    return {
      source: "customer",
      category: "CUSTOMER_PERSON",
      text: clause,
      entity,
      titleHook: `${entity}真的${trait}`,
      captionLine: `${entity}真的${trait}。`,
      coverLine: `${entity}真的${trait}`,
      priority: 2,
    };
  }
  const dish = clause.match(/芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|酸甜酱炒河虾/)?.[0];
  if (dish && /好|喜欢|推荐|Q弹|蒜香|甜|新鲜|不错|配料|下饭/.test(clause) && !/吃饭/.test(clause.replace(dish, ""))) {
    const line = faithfulDishLine(dish, clause);
    return {
      source: "customer",
      category: "CUSTOMER_FOOD",
      text: clause,
      entity: dish,
      titleHook: line.replace(/。$/, ""),
      captionLine: line,
      coverLine: line.replace(/。$/, ""),
      priority: 1,
    };
  }
  if (/方便/.test(clause) || /逛完|逛街/.test(clause)) {
    const hasMall = mentionsPlace(clause, mall);
    return {
      source: "customer",
      category: "CUSTOMER_SCENE",
      text: clause,
      entity: hasMall ? mall : "方便",
      titleHook: hasMall ? `逛完${mall}来吃饭很方便` : "来这里吃饭很方便",
      captionLine: hasMall ? `逛完${mall}来吃饭很方便。` : "来这里吃饭很方便。",
      coverLine: hasMall ? `逛完${mall}来吃饭很方便` : "来这里吃饭很方便",
      priority: 3,
    };
  }
  if (/环境|氛围/.test(clause) && /舒服|放松|温馨/.test(clause)) {
    const line = /放松/.test(clause) ? "坐着比较放松" : "环境很舒服";
    return {
      source: "customer",
      category: "CUSTOMER_ATMOSPHERE",
      text: clause,
      entity: "环境",
      titleHook: line,
      captionLine: `${line}。`,
      coverLine: line,
      priority: 4,
    };
  }
  if (/服务/.test(clause) && /好|热情|不错|舒服/.test(clause)) {
    return {
      source: "customer",
      category: "CUSTOMER_SERVICE",
      text: clause,
      entity: "服务",
      titleHook: "服务真的很好",
      captionLine: "服务真的很好。",
      coverLine: "服务真的很好",
      priority: 5,
    };
  }
  return null;
}

export function collectCustomerEvidence(input: {
  note?: string;
  dishes?: string[];
  enjoyMost?: string[];
  recommendTo?: string[];
  branch?: string;
}) {
  const note = input.note?.trim() ?? "";
  const mall = placeName(input.branch);
  const customer: EvidencePoint[] = [];
  for (const clause of clauses(note)) pushUnique(customer, fromClause(clause, mall));
  for (const reason of input.recommendTo ?? []) pushUnique(customer, fromClause(reason, mall));
  customer.sort((a, b) => a.priority - b.priority || b.entity.length - a.entity.length);

  const other: EvidencePoint[] = [];
  for (const dish of input.dishes ?? []) {
    const name = chineseFullDishName(dish) || dish;
    if (!name || name === "Others") continue;
    if (customer.some((item) => item.entity === name)) continue;
    pushUnique(other, {
      source: "other",
      category: "OTHER_DISH",
      text: name,
      entity: name,
      titleHook: `曼谷泰餐的${name}值得点`,
      captionLine: "",
      coverLine: name,
      priority: 10,
    });
  }
  if (!customer.some((item) => item.entity === mall) && !other.some((item) => item.entity === mall)) {
    other.push({
      source: "other",
      category: "OTHER_PLACE",
      text: mall,
      entity: mall,
      titleHook: `${mall}这家泰餐值得记`,
      captionLine: "",
      coverLine: `${mall}泰餐推荐`,
      priority: 11,
    });
  }
  return { customer, other };
}

export function formatCustomerEvidencePlan(input: {
  note?: string;
  dishes?: string[];
  enjoyMost?: string[];
  recommendTo?: string[];
  branch?: string;
}) {
  const { customer, other } = collectCustomerEvidence(input);
  if (customer.length === 0) {
    return `CUSTOMER-OWNED EVIDENCE: none. Do not invent 粉红奶, 老板很帅, 服务很好, or a room. Use selected dishes and the confirmed place only.`;
  }
  const customerLines = customer
    .map((item) => `- ${item.text} | ${item.category} | keep the name ${item.entity}`)
    .join("\n");
  const otherLines = other.map((item) => `- ${item.entity}`).join("\n");
  return `EVIDENCE ALLOCATION for this same JSON. Do not print these labels.
Pool A, customer-owned. Keep the exact name. 粉红奶 must not become 饮品.
${customerLines}
Pool B, other evidence. Use it to vary the titles. Do not let it replace Pool A.
${otherLines || "- none"}
Title 1 = a hook from the customer's own reason or the strongest Pool A item, not the whole sentence and not the mall.
Title 2 and Title 3 = different unused points from this visit. Use Pool B only when Pool A does not have another true point. Do not spend a title on the mall by default.
mainTitle comes from the personal story when there is one. subTitle uses a different point, not a synonym.
evidenceSource.title1 = "customer" when Title 1 uses Pool A.`;
}

function mentions(text: string, point: EvidencePoint) {
  return Boolean(point.entity && text.includes(point.entity));
}

function plain(text: string) {
  return text.replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, "");
}

const PAIRED_DISH =
  /芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|酸甜酱炒河虾/;
const FOREIGN_DISH_MARKERS = ["芒果", "菠萝", "蟹", "虾", "蒜", "鲈鱼", "青柠", "咖喱", "冬阴功", "空心菜", "糯米"];

function dishMismatch(title: string) {
  const dish = title.match(PAIRED_DISH)?.[0] ?? "";
  if (!dish) return false;
  const residue = title.replace(PAIRED_DISH, "");
  return FOREIGN_DISH_MARKERS.some((marker) => residue.includes(marker) && !dish.includes(marker));
}

const GENERIC_TEMPLATE_TITLE = /真的很好吃|真的好好吃|超好吃|值得一试|值得点|值得推荐/;

function titleShouldStay(title: string) {
  if (dishMismatch(title)) return false;
  const cleaned = title.replace(/🇹🇭/g, "").trim();
  if (GENERIC_TEMPLATE_TITLE.test(cleaned)) return false;
  return !headlineNeedsEvidenceReplacement(cleaned);
}

function faithfulFoodHook(point: EvidencePoint) {
  if (point.category === "CUSTOMER_FOOD" && point.entity) {
    if (/新鲜/.test(point.text)) return `${point.entity}很新鲜`;
    if (/配料/.test(point.text)) return `${point.entity}配料很足`;
    if (/下饭/.test(point.text)) return `${point.entity}很下饭`;
    if (/Q弹/.test(point.text)) return `${point.entity}很Q弹`;
    if (/蒜香/.test(point.text)) return `${point.entity}蒜香很足`;
  }
  return point.titleHook;
}

function repairMismatchedDish(title: string, point: EvidencePoint) {
  const named = title.match(PAIRED_DISH)?.[0] ?? "";
  if (!named || point.category !== "CUSTOMER_FOOD" || !point.entity || named === point.entity) return "";
  if (!dishMismatch(title)) return "";
  const residue = title.replace(PAIRED_DISH, "");
  const evaluationBelongsToPoint = FOREIGN_DISH_MARKERS.some(
    (marker) => residue.includes(marker) && point.entity.includes(marker),
  );
  if (!evaluationBelongsToPoint) return "";
  return title.replace(named, point.entity);
}

function titleUsesPointFaithfully(title: string, point: EvidencePoint) {
  if (!mentions(title, point)) return false;
  if (plain(title) === plain(point.text)) return false;
  if (EXTRA_TASTE.test(title) && !EXTRA_TASTE.test(point.text)) return false;
  if (/最帅|全曼谷|专业|训练有素/.test(title) && !/最帅|全曼谷|专业|训练有素/.test(point.text)) return false;
  return true;
}

function preserveFlag(previous: string, next: string) {
  if (previous.trimStart().startsWith("🇹🇭") && !next.startsWith("🇹🇭")) return `🇹🇭${next}`;
  return next;
}

function scrubCaption(caption: string, point: EvidencePoint) {
  let next = caption;
  if (point.category === "CUSTOMER_DRINK" && point.entity !== "饮品" && point.entity !== "饮料") {
    next = next
      .split(/(?<=[。！？])/u)
      .filter((sentence) => sentence.includes(point.entity) || !/饮品|饮料/.test(sentence))
      .join("");
    if (!next.includes(point.entity)) {
      next = next.replace(GENERIC_DRINK, point.entity);
    }
    if (!EXTRA_TASTE.test(point.text)) {
      next = next.replace(new RegExp(`[^。！？\\n]*${point.entity}[^。！？\\n]*`, "g"), (sentence) =>
        EXTRA_TASTE.test(sentence) ? point.captionLine.replace(/。$/, "") : sentence,
      );
    }
  }
  if (point.category === "CUSTOMER_PERSON" && point.entity === "老板" && !/店员|服务人员|工作人员/.test(point.text)) {
    next = next.replace(
      /[^。！？\n]*?(?:服务人员很亲切|店员很亲切|工作人员形象很好|工作人员很亲切)[^。！？\n]*/g,
      "老板真的很帅",
    );
    if (/最帅|全曼谷/.test(next) && !/最帅|全曼谷/.test(point.text)) {
      next = next.replace(/[^。！？\n]*老板[^。！？\n]*/g, "老板真的很帅");
    }
  }
  if (point.category === "CUSTOMER_SERVICE" && !/专业|训练有素|周到/.test(point.text)) {
    next = next.replace(/服务专业周到[^。！？\n]*|员工训练有素|服务非常专业、贴心、周到/g, "服务真的很好");
  }
  return next;
}

function coverPair(
  customer: EvidencePoint,
  other: EvidencePoint | undefined,
  titles: [string, string, string],
  context: CoverTitleContext,
) {
  const mall = placeName(context.branch);
  const mains = [
    other?.entity === mall ? `${mall}泰餐推荐` : "",
    "曼谷美食推荐",
    "曼谷泰餐推荐",
    `${mall}泰餐推荐`,
    other?.category === "OTHER_DISH" ? `曼谷必吃${other.coverLine}`.slice(0, 12) : "",
  ].filter(Boolean);
  const subs = [customer.coverLine, customer.titleHook].filter((line) => line.length >= 6 && line.length <= 15);
  for (const main of mains) {
    for (const sub of subs) {
      if (main.includes(customer.entity) && sub.includes(customer.entity)) continue;
      if (isAcceptableCoverOverlay(main, sub, titles, context)) return { title: main, subtitle: sub };
    }
  }
  return { title: "曼谷泰餐推荐", subtitle: customer.coverLine };
}

export function enforceCustomerEvidence(input: {
  titles: [string, string, string];
  caption: string;
  coverTitle: string;
  coverSubtitle: string;
  note?: string;
  dishes?: string[];
  enjoyMost?: string[];
  recommendTo?: string[];
  branch?: string;
}) {
  const { customer, other } = collectCustomerEvidence(input);
  if (customer.length === 0) {
    return {
      titles: input.titles,
      caption: input.caption,
      coverTitle: input.coverTitle,
      coverSubtitle: input.coverSubtitle,
    };
  }

  const titles: [string, string, string] = [...input.titles];
  const primary = customer[0];
  if (!primary) {
    return {
      titles,
      caption: input.caption,
      coverTitle: input.coverTitle,
      coverSubtitle: input.coverSubtitle,
    };
  }
  if (
    !titleShouldStay(titles[0]) &&
    (!titleUsesPointFaithfully(titles[0], primary) || isCopiedCustomerLine(titles[0], input.note ?? ""))
  ) {
    const repaired = repairMismatchedDish(titles[0], primary);
    titles[0] = preserveFlag(titles[0], repaired || faithfulFoodHook(primary));
  }

  const used = new Set<string>([primary.entity]);
  const otherHit = other.find(
    (item) => mentions(titles[1], item) && !used.has(item.entity) && titleUsesPointFaithfully(titles[1], item),
  );
  const second = otherHit ?? other.find((item) => !used.has(item.entity));
  if (second && !otherHit && !titleShouldStay(titles[1])) titles[1] = preserveFlag(titles[1], second.titleHook);
  if (second) used.add(second.entity);

  const pools = [...customer, ...other];
  const title3Hit = pools.find(
    (item) => !used.has(item.entity) && mentions(titles[2], item) && titleUsesPointFaithfully(titles[2], item),
  );
  const third = title3Hit ?? pools.find((item) => !used.has(item.entity));
  if (third && !title3Hit && !titleShouldStay(titles[2])) titles[2] = preserveFlag(titles[2], third.titleHook);
  if (third) used.add(third.entity);

  if (!titles.some((title) => keywordInTitle(title)) && !titleShouldStay(titles[1])) {
    const dish = other.find((item) => item.category === "OTHER_DISH");
    titles[1] = dish ? `曼谷泰餐的${dish.entity}值得点` : titles[1].includes("曼谷") ? titles[1] : `曼谷泰餐${titles[1]}`;
  }

  let coverTitle = input.coverTitle;
  let coverSubtitle = input.coverSubtitle;
  for (const point of customer) {
    const repairedTitle = repairMismatchedDish(coverTitle, point);
    if (repairedTitle) coverTitle = repairedTitle;
    const repairedSubtitle = repairMismatchedDish(coverSubtitle, point);
    if (repairedSubtitle) coverSubtitle = repairedSubtitle;
  }
  const coverTitleBroken = headlineNeedsEvidenceReplacement(coverTitle);
  const coverSubtitleBroken = headlineNeedsEvidenceReplacement(coverSubtitle);
  if (coverTitleBroken || coverSubtitleBroken) {
    const coverContext: CoverTitleContext = {
      diningNote: input.note,
      dishes: input.dishes,
      enjoyMost: input.enjoyMost,
      recommendTo: input.recommendTo,
      branch: input.branch,
      sourceTexts: titles,
    };
    const pair = coverPair(primary, second?.source === "other" ? second : other[0], titles, coverContext);
    if (coverTitleBroken) coverTitle = pair.title;
    if (coverSubtitleBroken) coverSubtitle = pair.subtitle;
  }

  let caption = input.caption;
  for (const point of customer) caption = scrubCaption(caption, point);
  const required = customer.slice(0, 4).filter((point) => point.captionLine && !caption.includes(point.entity));
  if (required.length > 0) {
    const block = required
      .slice(0, 3)
      .map((point) => point.captionLine)
      .join("");
    caption = `${block}\n\n${caption}`.trim();
  }

  const customerEvidence = [input.note, ...(input.recommendTo ?? []), ...(input.enjoyMost ?? [])]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
  return { titles, caption: arrangeDiningStory(caption, "", customerEvidence), coverTitle, coverSubtitle };
}
