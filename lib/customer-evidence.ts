import { arrangeDiningStory } from "@/lib/caption-story";
import { chineseFullDishName } from "@/lib/cover/dish-names";
import { isAcceptableCoverOverlay } from "@/lib/cover/cover-title";
import type { CoverTitleContext } from "@/lib/cover/cover-rules";
import { keywordInTitle } from "@/lib/title-keywords";
import { isCopiedCustomerLine } from "@/lib/title-insight";

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
  return note
    .split(/[。！？!?\n；;，,、]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
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

function fromClause(clause: string): EvidencePoint | null {
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
  if (dish && /好|喜欢|推荐|Q弹|蒜香|甜|新鲜|不错/.test(clause) && !/吃饭/.test(clause.replace(dish, ""))) {
    return {
      source: "customer",
      category: "CUSTOMER_FOOD",
      text: clause,
      entity: dish,
      titleHook: `${dish}真的很好吃`,
      captionLine: `${dish}真的很好吃。`,
      coverLine: `${dish}真的很好吃`,
      priority: 1,
    };
  }
  if (/方便/.test(clause) || /逛完|逛街/.test(clause)) {
    const hasMall = /centralwOrld/.test(clause);
    return {
      source: "customer",
      category: "CUSTOMER_SCENE",
      text: clause,
      entity: hasMall ? "centralwOrld" : "方便",
      titleHook: hasMall ? "逛完centralwOrld来吃饭很方便" : "来这里吃饭很方便",
      captionLine: hasMall ? "逛完centralwOrld来吃饭很方便。" : "来这里吃饭很方便。",
      coverLine: hasMall ? "逛完centralwOrld来吃饭很方便" : "来这里吃饭很方便",
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
}) {
  const note = input.note?.trim() ?? "";
  const customer: EvidencePoint[] = [];
  for (const clause of clauses(note)) pushUnique(customer, fromClause(clause));
  for (const reason of input.recommendTo ?? []) pushUnique(customer, fromClause(reason));
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
  if (!customer.some((item) => item.entity === "centralwOrld") && !other.some((item) => item.entity === "centralwOrld")) {
    other.push({
      source: "other",
      category: "OTHER_PLACE",
      text: "centralwOrld",
      entity: "centralwOrld",
      titleHook: "centralwOrld这家泰餐值得记",
      captionLine: "",
      coverLine: "centralwOrld泰餐推荐",
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
Title 1 = a hook from the first Pool A item, not the whole sentence.
Title 2 = a different Pool B item.
Title 3 = another unused item.
One of mainTitle / subTitle uses Pool A. The other uses a different point.
evidenceSource.title1 = "customer". evidenceSource.title2 = "other".`;
}

function mentions(text: string, point: EvidencePoint) {
  return Boolean(point.entity && text.includes(point.entity));
}

function plain(text: string) {
  return text.replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, "");
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
  const mains = [
    other?.entity === "centralwOrld" ? "centralwOrld泰餐推荐" : "",
    "曼谷美食推荐",
    "曼谷泰餐推荐",
    "centralwOrld泰餐推荐",
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
  if (!titleUsesPointFaithfully(titles[0], primary) || isCopiedCustomerLine(titles[0], input.note ?? "")) {
    titles[0] = preserveFlag(titles[0], primary.titleHook);
  }

  const used = new Set<string>([primary.entity]);
  const otherHit = other.find(
    (item) => mentions(titles[1], item) && !used.has(item.entity) && titleUsesPointFaithfully(titles[1], item),
  );
  const second = otherHit ?? other.find((item) => !used.has(item.entity));
  if (second && !otherHit) titles[1] = preserveFlag(titles[1], second.titleHook);
  if (second) used.add(second.entity);

  const pools = [...customer, ...other];
  const title3Hit = pools.find(
    (item) => !used.has(item.entity) && mentions(titles[2], item) && titleUsesPointFaithfully(titles[2], item),
  );
  const third = title3Hit ?? pools.find((item) => !used.has(item.entity));
  if (third && !title3Hit) titles[2] = preserveFlag(titles[2], third.titleHook);
  if (third) used.add(third.entity);

  if (!titles.some((title) => keywordInTitle(title))) {
    const dish = other.find((item) => item.category === "OTHER_DISH");
    titles[1] = dish ? `曼谷泰餐的${dish.entity}值得点` : titles[1].includes("曼谷") ? titles[1] : `曼谷泰餐${titles[1]}`;
  }

  const coverContext: CoverTitleContext = {
    diningNote: input.note,
    dishes: input.dishes,
    enjoyMost: input.enjoyMost,
    recommendTo: input.recommendTo,
    branch: input.branch,
    sourceTexts: titles,
  };
  let coverTitle = input.coverTitle;
  let coverSubtitle = input.coverSubtitle;
  const coverBlob = `${coverTitle}\n${coverSubtitle}`;
  const coverHasCustomer = customer.some((item) => mentions(coverBlob, item));
  const coverRepeatsOnePoint =
    customer.filter((item) => mentions(coverTitle, item)).some((item) => mentions(coverSubtitle, item));
  if (!coverHasCustomer || coverRepeatsOnePoint) {
    const pair = coverPair(primary, second?.source === "other" ? second : other[0], titles, coverContext);
    coverTitle = pair.title;
    coverSubtitle = pair.subtitle;
  }

  const headlineBlob = `${titles.join("\n")}\n${coverTitle}\n${coverSubtitle}`;
  if (!headlineBlob.includes("centralwOrld")) {
    const mallMain = "centralwOrld泰餐推荐";
    if (isAcceptableCoverOverlay(mallMain, coverSubtitle, titles, coverContext)) coverTitle = mallMain;
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

  return { titles, caption: arrangeDiningStory(caption), coverTitle, coverSubtitle };
}
