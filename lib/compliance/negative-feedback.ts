export const NEGATIVE_FEEDBACK_CATEGORY = "negative" as const;

export type NegativePhraseRule = {
  phrase: string;
  category: typeof NEGATIVE_FEEDBACK_CATEGORY;
  replacement: string;
};

/**
 * Longest-first. Used as a last-resort output rewrite.
 * Generation should still pick context-aware neutral wording, not copy these phrases blindly.
 */
const NEGATIVE_PHRASE_MAPPINGS: Array<{ phrase: string; replacement: string }> = [
  { phrase: "抽奖送东西才吸引人", replacement: "设有互动活动及礼品机制" },
  { phrase: "就是为了抽奖送东西", replacement: "店内设有互动抽奖和礼品活动" },
  { phrase: "就是为了抽奖才来", replacement: "活动提供额外互动体验" },
  { phrase: "送东西吸引顾客", replacement: "搭配互动活动增加参与感" },
  { phrase: "不好吃到不行", replacement: "口味因人而异" },
  { phrase: "绝对不会踩雷", replacement: "整体体验比较不错" },
  { phrase: "为了抽奖才来", replacement: "活动提供额外互动体验" },
  { phrase: "抽奖送东西", replacement: "有互动活动和礼品" },
  { phrase: "送东西吸引人", replacement: "搭配互动活动增加参与感" },
  { phrase: "抽奖才吸引人", replacement: "设有互动活动及礼品机制" },
  { phrase: "服务态度不好", replacement: "和店员沟通可能需要多一些耐心" },
  { phrase: "花钱不值得", replacement: "可以结合预算和需求考虑" },
  { phrase: "贵到吃不起", replacement: "价格偏高" },
  { phrase: "我觉得不好吃", replacement: "口味比较因人而异" },
  { phrase: "价格有点儿贵", replacement: "价格相对较高" },
  { phrase: "价格有点贵", replacement: "价格相对较高" },
  { phrase: "感觉踩雷了", replacement: "整体口味比较有个人特色" },
  { phrase: "性价比很低", replacement: "价格和个人预期有所不同" },
  { phrase: "没什么特别", replacement: "整体风味比较经典" },
  { phrase: "不会再来了", replacement: "更适合尝试不同类型餐厅的人" },
  { phrase: "性价比不高", replacement: "价格和个人预期有所不同" },
  { phrase: "性价比低", replacement: "价格和个人预期有所不同" },
  { phrase: "不会再来", replacement: "更适合尝试不同类型餐厅的人" },
  { phrase: "不会再去", replacement: "更适合尝试不同类型餐厅的人" },
  { phrase: "不会回购", replacement: "是否再次选择可以根据个人喜好决定" },
  { phrase: "不会踩雷", replacement: "可以根据个人口味选择" },
  { phrase: "服务不好", replacement: "用餐高峰期服务可能会比较慢" },
  { phrase: "态度不好", replacement: "和店员沟通可能需要多一些耐心" },
  { phrase: "有点儿贵", replacement: "价格相对较高" },
  { phrase: "不太推荐", replacement: "适合不同口味需求的人群" },
  { phrase: "不太喜欢", replacement: "个人口味偏好不同" },
  { phrase: "有点失望", replacement: "与个人预期有所不同" },
  { phrase: "感到失望", replacement: "与个人预期有所不同" },
  { phrase: "让人失望", replacement: "与个人预期有所不同" },
  { phrase: "比较普通", replacement: "整体风味比较经典" },
  { phrase: "味道一般", replacement: "整体风味比较经典" },
  { phrase: "感觉踩雷", replacement: "整体口味比较有个人特色" },
  { phrase: "价格太贵", replacement: "价格相对较高" },
  { phrase: "价格很贵", replacement: "价格较高" },
  { phrase: "有点贵", replacement: "价格相对较高" },
  { phrase: "不值得来", replacement: "可以结合预算和需求考虑" },
  { phrase: "不推荐", replacement: "适合不同口味需求的人群" },
  { phrase: "不值得", replacement: "可以结合预算和需求考虑" },
  { phrase: "很失望", replacement: "与个人预期有所不同" },
  { phrase: "太失望", replacement: "与个人预期有所不同" },
  { phrase: "不喜欢", replacement: "个人口味偏好不同" },
  { phrase: "很普通", replacement: "整体风味比较经典" },
  { phrase: "太普通", replacement: "整体风味比较经典" },
  { phrase: "不好吃", replacement: "口味因人而异" },
  { phrase: "太难吃", replacement: "泰餐口味比较看个人喜好" },
  { phrase: "很难吃", replacement: "泰餐口味比较看个人喜好" },
  { phrase: "踩雷了", replacement: "整体口味比较有个人特色" },
  { phrase: "价格贵", replacement: "价格偏高" },
  { phrase: "真的贵", replacement: "价格偏高" },
  { phrase: "太贵了", replacement: "价格相对较高" },
  { phrase: "有些贵", replacement: "价格相对较高" },
  { phrase: "吃不起", replacement: "价格偏高" },
  { phrase: "难吃", replacement: "泰餐口味比较看个人喜好" },
  { phrase: "踩雷", replacement: "可以根据个人口味选择" },
  { phrase: "太贵", replacement: "价格相对较高" },
  { phrase: "很贵", replacement: "价格较高" },
  { phrase: "真贵", replacement: "价格偏高" },
  { phrase: "好贵", replacement: "价格偏高" },
  { phrase: "超贵", replacement: "价格相对较高" },
  { phrase: "昂贵", replacement: "价格偏高" },
  { phrase: "偏贵", replacement: "价格偏高" },
  { phrase: "略贵", replacement: "价格偏高" },
  { phrase: "小贵", replacement: "价格偏高" },
  { phrase: "贵了", replacement: "价格偏高" },
].sort((a, b) => b.phrase.length - a.phrase.length);

export const NEGATIVE_PHRASE_RULES: NegativePhraseRule[] = NEGATIVE_PHRASE_MAPPINGS.map((item) => ({
  ...item,
  category: NEGATIVE_FEEDBACK_CATEGORY,
}));

/** Residual matches after longer phrases are rewritten. Do not use 贵/失望 as naive substring replaces. */
export const NEGATIVE_RESIDUAL_PATTERNS = [
  {
    pattern: /避雷(?!针)/g,
    phrase: "避雷",
    replacement: "建议根据个人喜好选择",
  },
  {
    pattern: /(?<![宝名珍贵宾金])贵(?![州阳宾族重金属物妇妃])/g,
    phrase: "贵",
    replacement: "价格偏高",
  },
  {
    pattern: /(?<!不)失望/g,
    phrase: "失望",
    replacement: "与个人预期有所不同",
  },
] as const;

function sortedNegativePhrases() {
  return NEGATIVE_PHRASE_RULES;
}

export function neutralizeHarshNegatives(text: string) {
  if (!text) return text;
  let next = text;
  for (const rule of sortedNegativePhrases()) {
    if (!rule.phrase) continue;
    next = next.split(rule.phrase).join(rule.replacement);
  }
  for (const rule of NEGATIVE_RESIDUAL_PATTERNS) {
    rule.pattern.lastIndex = 0;
    next = next.replace(rule.pattern, rule.replacement);
    rule.pattern.lastIndex = 0;
  }
  return next;
}

export function findHarshNegativeHits(text: string) {
  if (!text) return [] as Array<{ phrase: string; replacement: string }>;
  const hits: Array<{ phrase: string; replacement: string }> = [];
  const seen = new Set<string>();

  for (const rule of sortedNegativePhrases()) {
    if (!rule.phrase || !text.includes(rule.phrase) || seen.has(rule.phrase)) continue;
    seen.add(rule.phrase);
    hits.push({ phrase: rule.phrase, replacement: rule.replacement });
  }

  for (const rule of NEGATIVE_RESIDUAL_PATTERNS) {
    if (seen.has(rule.phrase)) continue;
    rule.pattern.lastIndex = 0;
    const matched = rule.pattern.test(text);
    rule.pattern.lastIndex = 0;
    if (!matched) continue;
    seen.add(rule.phrase);
    hits.push({ phrase: rule.phrase, replacement: rule.replacement });
  }

  return hits;
}

export function containsHarshNegative(text: string) {
  return findHarshNegativeHits(text).length > 0;
}

export function formatNegativeNeutralizationRules() {
  return `CUSTOMER NEGATIVE FEEDBACK — MANDATORY.

Customer answers may contain harsh, colloquial, or damaging judgments. Keep those words as INTERNAL INPUT ONLY.
Never copy them into titles, caption, hashtags, mainTitle, or subTitle.

PRESERVE MEANING. Do not delete the feedback. Rewrite:
Negative expression → Neutral, objective, natural, brand-safe wording.
NOT Negative → Delete.
NOT Negative → False positive praise.

Do NOT turn 贵 into 超高性价比 / 超划算.
Do NOT turn 难吃 / 不好吃 into 超级好吃 / 必吃 / 必吃推荐.
Do NOT turn 踩雷 / 避雷 into 必吃推荐 / 绝对不会踩雷.
Do NOT turn 抽奖送东西 / 为了抽奖才来 into 超大福利.
Do NOT invent 超好吃 / 必吃 / 性价比超高 / 超划算 / 人气爆棚 / 超级推荐 / 绝对不会踩雷 / 全网第一 / 曼谷最好吃 / 必打卡 unless verified brand information already supports that exact claim. Cover keyword 必吃 is the only exception, and only in mainTitle/subTitle.

Preferred neutral wording — keep the meaning, weave it in naturally. Do not paste the same sentence every time if a close variation fits better:
贵 / 太贵 / 很贵 / 价格有点贵 → 价格偏高 / 价格相对较高 / 价格较高
难吃 / 太难吃 / 很难吃 → 泰餐口味比较看个人喜好
不好吃 / 我觉得不好吃 → 口味因人而异 / 口味比较因人而异
踩雷 / 感觉踩雷了 → 可以根据个人口味选择 / 整体口味比较有个人特色
避雷 → 建议根据个人喜好选择
不推荐 → 适合不同口味需求的人群
不值得 / 花钱不值得 → 可以结合预算和需求考虑
性价比低 / 性价比很低 → 价格和个人预期有所不同
失望 / 很失望 → 与个人预期有所不同
不喜欢 → 个人口味偏好不同
很普通 / 没什么特别 → 整体风味比较经典
服务不好 → 用餐高峰期服务可能会比较慢
态度不好 → 和店员沟通可能需要多一些耐心
不会再来 → 更适合尝试不同类型餐厅的人
不会回购 → 是否再次选择可以根据个人喜好决定
抽奖送东西 / 送东西吸引顾客 → 有互动活动和礼品 / 搭配互动活动增加参与感
为了抽奖才来 → 活动提供额外互动体验 / 店内设有互动抽奖和礼品活动

These neutralized meanings apply to the Xiaohongshu caption AND any cover text derived from customer feedback. Never put the raw negative on the cover.
If the full phrase is too long for mainTitle (4–7) or subTitle (4–9), use a shorter sibling of the SAME meaning: 口味看个人喜好 / 整体风味比较经典 / 价格看个人预期. Never 难吃 / 性价比低 / 很普通 / 服务不好 / 态度不好 / 不会回购.
If price or activity is relevant on cover, also fine: 价格偏高 / 互动抽奖活动 / 曼谷特色泰餐 / centralwOrld美食.

COVER mainTitle / subTitle must NEVER use raw negatives: 贵 / 太贵 / 难吃 / 不好吃 / 踩雷 / 避雷 / 不推荐 / 不值得 / 失望 / 抽奖送东西 / 贵到吃不起 / 性价比低 / 很普通 / 没什么特别 / 服务不好 / 态度不好 / 不会回购.

PRIORITY when transforming: 1) verified brand / menu facts 2) actual customer experience 3) customer-selected keywords 4) KSP 5) natural neutral wording.
Never invent extra incidents, wait times, staff names, or praise the customer did not give.
The approved 服务不好 softening is a general, non-confrontational framing — do not add a made-up peak-hour story around it.

Tone: natural Xiaohongshu, objective, friendly, non-confrontational. Do not sound like a complaint reply. Weave the neutralized meaning into the caption (and cover, if relevant) as part of the story.`;
}
