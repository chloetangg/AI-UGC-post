/**
 * Cover mainTitle / subTitle: no ranking or absolute “No.1 / 最 / 全范围” claims.
 * 第一次 / 第一道 / 最近 / 最后 / 最终 stay. 最爱 always becomes 超爱.
 */
const COVER_ABSOLUTE_REPLACEMENTS: Array<{ phrase: string; replacement: string }> = [
  { phrase: "必吃第一名", replacement: "很想再吃" },
  { phrase: "曼谷最好吃的泰餐", replacement: "超爱这家泰餐" },
  { phrase: "曼谷最好吃", replacement: "曼谷超爱" },
  { phrase: "泰国最好吃", replacement: "超爱这家" },
  { phrase: "最好吃的", replacement: "超爱" },
  { phrase: "最好吃", replacement: "超爱" },
  { phrase: "最值得点的菜", replacement: "这道真的很喜欢" },
  { phrase: "最值得点", replacement: "真的很喜欢" },
  { phrase: "最值得", replacement: "真的很喜欢" },
  { phrase: "最推荐", replacement: "真的很推荐" },
  { phrase: "最正宗的泰餐", replacement: "很有泰式风味" },
  { phrase: "最正宗", replacement: "很有泰式风味" },
  { phrase: "最便宜", replacement: "价格还可以" },
  { phrase: "最划算", replacement: "很能吃" },
  { phrase: "最喜欢的是", replacement: "超爱的是" },
  { phrase: "最喜欢的", replacement: "超爱的" },
  { phrase: "最喜欢", replacement: "超爱" },
  { phrase: "最爱的", replacement: "超爱的" },
  { phrase: "最爱", replacement: "超爱" },
  { phrase: "最火", replacement: "好多人吃" },
  { phrase: "最强", replacement: "超爱" },
  { phrase: "最绝", replacement: "真的很香" },
  { phrase: "之最", replacement: "超爱" },
  { phrase: "天花板级别", replacement: "超爱" },
  { phrase: "天花板", replacement: "超爱" },
  { phrase: "无敌", replacement: "超爱" },
  { phrase: "全网第一", replacement: "超爱这家" },
  { phrase: "曼谷第一泰餐", replacement: "曼谷超爱泰餐" },
  { phrase: "曼谷第一", replacement: "曼谷超爱" },
  { phrase: "泰国第一", replacement: "超爱这家" },
  { phrase: "第一名", replacement: "超爱" },
  { phrase: "第一梯队", replacement: "超爱" },
  { phrase: "销量冠军", replacement: "超爱" },
  { phrase: "冠军", replacement: "超爱" },
  { phrase: "全曼谷", replacement: "曼谷" },
  { phrase: "全泰国", replacement: "泰国" },
  { phrase: "必须吃", replacement: "很想再吃" },
  { phrase: "必吃的", replacement: "很想再吃的" },
  { phrase: "百分百", replacement: "真的" },
  { phrase: "100%", replacement: "真的" },
].sort((a, b) => b.phrase.length - a.phrase.length);

export function sanitizeCoverAbsoluteLanguage(text: string) {
  if (!text) return text;
  let next = text;
  for (const rule of COVER_ABSOLUTE_REPLACEMENTS) {
    next = next.split(rule.phrase).join(rule.replacement);
  }
  next = next.replace(/No\.?\s*1/gi, "超爱");
  next = next.replace(/TOP\s*1/gi, "超爱");
  next = next.replace(/100\s*%/g, "真的");
  next = next.replace(/第一(?!次|道)/g, "超爱");
  next = next.replace(/最(?!近|后|终)\S{0,2}/g, "超爱");
  return next;
}

export function hasCoverAbsoluteLanguage(text: string) {
  return Boolean(text) && sanitizeCoverAbsoluteLanguage(text) !== text;
}

export function formatCoverAbsoluteRules() {
  return `COVER ABSOLUTE / RANKING LANGUAGE — MANDATORY for mainTitle AND subTitle.

Never use ranking, No.1, or universal-superiority wording, even if a review or reference used it:
最 / 第一 / 第一名 / Top 1 / TOP1 / No.1 / 冠军 / 之最 / 最爱 / 最好吃 / 最值得 / 最推荐 / 最正宗 / 最便宜 / 最划算 / 最火 / 最强 / 最绝 / 天花板 / 无敌 / 全网第一 / 曼谷第一 / 泰国第一 / 全曼谷 / 全泰国 / 100% / 百分百 / 必须吃 / 必吃第一名
任何“第一 / 排名 / 全部范围 / 绝对优势”的意思都不要上封面。

例外（不是排名）：第一次 / 第一道 / 最近 / 最后 / 最终. Cover keyword 必吃 may still appear as a pool keyword (曼谷必吃 / 必吃泰式料理), but never 必须吃 / 必吃第一名 / 必吃的泰餐 as a ranking claim.

最爱 is NOT allowed. Always rewrite 最爱 → 超爱. Any leftover 最 must be rewritten.

Prefer a diner's personal feeling over an objective ranking, only when THIS visit supports it:
超爱 / 很喜欢 / 好喜欢 / 真的喜欢 / 太好吃了 / 真的很香 / 很惊喜 / 意外好吃 / 很想再吃 / 下次还要点 / 这道可以 / 真的很推荐 / 让我记住了 / 吃完还在想
Do not invent 一口就爱上 / 很惊喜 unless the evidence has that feeling.

REWRITE:
❌ 曼谷最好吃的泰餐 → ✅ 超爱这家泰餐
❌ 曼谷第一泰餐 → ✅ 曼谷超爱泰餐
❌ 最好吃的蟹肉滑蛋 → ✅ 超爱蟹肉滑蛋
❌ 必吃的泰餐 → ✅ 很想再吃的泰餐
❌ 最正宗的泰餐 → ✅ 很有泰式风味
❌ 最值得点的菜 → ✅ 这道真的很喜欢
❌ 曼谷最强冬阴功 → ✅ 超爱这碗冬阴功
❌ 我最爱这道 → ✅ 我超爱这道
❌ 没想到最喜欢这道 → ✅ 没想到超爱这道

BEFORE RETURN: if mainTitle or subTitle contains 最 (except 最近/最后/最终), 第一 (except 第一次/第一道), No.1, 冠军, 天花板, 全曼谷/全泰国, rewrite into a short subjective line. The cover should say “这是消费者很喜欢的东西”, never “这是客观上排名第一的东西”.`;
}
