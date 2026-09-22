import type { CoverTitleContext } from "@/lib/cover/cover-rules";

export type PartyKind = "two" | "solo" | "family" | "kids" | "friends" | "partner" | "group" | "family-suitable";

const PARTY_KIND_PATTERNS: Array<{ kind: PartyKind; pattern: RegExp }> = [
  { kind: "two", pattern: /两个人|两人来|两人吃|两人用餐|两个人约会|二人世界|就我们俩|俩人/ },
  { kind: "solo", pattern: /一个人来|一个人吃|一个人用餐|自己一个人|独自(?:来|吃)|一个人也/ },
  { kind: "family", pattern: /和家人|跟家人|家人一起|带家人|全家(?:人|出)|一家[一二三四五六七八九十两\d]口|一家三口|一家四口/ },
  { kind: "kids", pattern: /和孩子|带孩子来|带娃来|带了小孩|和小朋友一起|带小朋友来/ },
  { kind: "family-suitable", pattern: /适合带小朋友|适合家庭|家庭用餐/ },
  { kind: "friends", pattern: /和朋友|跟朋友|朋友一起|和闺蜜|跟闺蜜|和同事一起/ },
  { kind: "partner", pattern: /和伴侣|和男朋友|和女朋友|和老公|和老婆|两个人约会/ },
  { kind: "group", pattern: /几个人|我们几个|多人聚餐|朋友聚餐/ },
];

/** Customer-written / selected words only. Never dish count, photos, spend, or demographics. */
export function customerPartySource(context: CoverTitleContext = {}) {
  const tags = (context.enjoyMost ?? []).filter((tag) => tag && tag !== "其他" && tag !== "餐厅风格有满满的家庭式温馨氛围");
  return [context.diningNote ?? "", ...tags].join(" ");
}

export function detectedPartyKinds(text: string) {
  const kinds = new Set<PartyKind>();
  for (const item of PARTY_KIND_PATTERNS) {
    if (item.pattern.test(text)) kinds.add(item.kind);
  }
  return kinds;
}

export function hasExplicitPartyEvidence(context: CoverTitleContext = {}) {
  const kinds = detectedPartyKinds(customerPartySource(context));
  kinds.delete("family-suitable");
  return kinds.size > 0;
}

export function formatPartySizeRules(context: CoverTitleContext = {}) {
  const kinds = [...detectedPartyKinds(customerPartySource(context))];
  return `PARTY SIZE — only if the customer explicitly wrote or selected who they dined with.
Allowed this visit: ${kinds.length ? kinds.join(", ") : "NONE — do not mention any headcount or companion."}
If NONE, write 这次来吃 / 这顿吃下来 / 来这里吃. Never invent 两个人 / 和朋友 / 一家三口 / 适合一家人 / 一个人来 / 带家人 / 我们几个人.
Do not infer party size from tourist/local, dish count, photo count, spend, table photos, or other form answers.
฿2,000 ≠ 一家人. 4 dishes ≠ 几个人. 4 photos ≠ 一起吃.`;
}

const STRIPPERS: Array<{ kinds: PartyKind[]; pattern: RegExp; replacement: string }> = [
  { kinds: ["two"], pattern: /两个人来/g, replacement: "这次来" },
  { kinds: ["two"], pattern: /两个人吃下来/g, replacement: "这顿吃下来" },
  { kinds: ["two"], pattern: /两个人吃饭刚好/g, replacement: "这次吃饭刚好" },
  { kinds: ["two"], pattern: /两个人吃饭/g, replacement: "这次吃饭" },
  { kinds: ["two"], pattern: /两个人点/g, replacement: "这次点" },
  { kinds: ["two"], pattern: /两个人吃/g, replacement: "这次吃" },
  { kinds: ["two"], pattern: /两人(?=\d|泰铢)/g, replacement: "" },
  { kinds: ["solo"], pattern: /一个人来吃/g, replacement: "来吃" },
  { kinds: ["solo"], pattern: /一个人吃/g, replacement: "这次吃" },
  { kinds: ["solo"], pattern: /一个人来/g, replacement: "这次来" },
  { kinds: ["family", "kids"], pattern: /带家人来吃/g, replacement: "来吃" },
  { kinds: ["family", "kids"], pattern: /带家人吃/g, replacement: "吃" },
  { kinds: ["family", "kids"], pattern: /很适合带家人一起吃饭/g, replacement: "这顿吃下来很舒服" },
  { kinds: ["family"], pattern: /适合一家人一起吃/g, replacement: "这次来吃" },
  { kinds: ["family"], pattern: /一家人吃下来/g, replacement: "这顿吃下来" },
  { kinds: ["family"], pattern: /一家[三四五]口来/g, replacement: "这次来" },
  { kinds: ["family"], pattern: /一家[三四五]口/g, replacement: "这次" },
  { kinds: ["family"], pattern: /一家人/g, replacement: "这次" },
  { kinds: ["family", "family-suitable"], pattern: /很适合家庭用餐/g, replacement: "这顿吃下来很舒服" },
  { kinds: ["family", "family-suitable"], pattern: /适合家庭用餐/g, replacement: "这顿吃下来" },
  { kinds: ["family", "family-suitable"], pattern: /很适合家庭/g, replacement: "氛围比较温馨" },
  { kinds: ["kids"], pattern: /带小朋友来/g, replacement: "来" },
  { kinds: ["kids"], pattern: /带娃来/g, replacement: "来" },
  { kinds: ["friends"], pattern: /和朋友一起吃/g, replacement: "这次吃" },
  { kinds: ["friends"], pattern: /跟朋友一起/g, replacement: "这次" },
  { kinds: ["friends"], pattern: /和朋友一起/g, replacement: "这次" },
  { kinds: ["friends"], pattern: /朋友一起吃/g, replacement: "这次吃" },
  { kinds: ["friends"], pattern: /适合朋友聚餐/g, replacement: "这次来吃" },
  { kinds: ["friends"], pattern: /朋友聚餐/g, replacement: "这次来吃" },
  { kinds: ["group"], pattern: /我们几个人一起/g, replacement: "这次" },
  { kinds: ["group"], pattern: /刚好够我们几个人吃/g, replacement: "这几道菜吃下来刚刚好" },
  { kinds: ["group"], pattern: /我们几个人/g, replacement: "这次" },
  { kinds: ["group"], pattern: /几个人一起/g, replacement: "这次" },
  { kinds: ["partner"], pattern: /两个人约会/g, replacement: "这次来吃" },
];

export function neutralizeInventedPartyCopy(text: string, context: CoverTitleContext = {}) {
  const allowed = detectedPartyKinds(customerPartySource(context));
  let next = text;
  for (const item of STRIPPERS) {
    if (item.kinds.some((kind) => allowed.has(kind))) continue;
    next = next.replace(item.pattern, item.replacement);
  }
  return next.replace(/\s{2,}/g, " ").replace(/，{2,}/g, "，").trim();
}
