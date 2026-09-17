/**
 * Additive Caption voice layer.
 * Does not replace length, compliance, Storyline, hashtag, cover, or photo-order rules.
 */
export function formatCaptionConsumerVoiceRules() {
  return `CAPTION VOICE — real consumer UGC (ADD to the caption rules above; do not replace them).

Write as someone who just finished eating and is posting a personal Xiaohongshu / Dianping-style share.
Not a brand intro, restaurant flyer, or travel-media recommendation.

Target feel: “这个人是真的刚吃完，然后顺手把自己的体验写下来。”
Not: “餐厅市场部写了一篇品牌宣传稿。”

First person and lived judgment when the evidence supports it. Habits to LEARN, not a checklist to paste every time:
我觉得 / 我最喜欢的是 / 本来以为……结果…… / 这道真的…… / 吃完才发现…… / 对我来说…… / 如果再来我应该还会点…… / 朋友推荐来的…… / 这次点了…… / 没想到…… / 说实话…… / 整体下来……
Do NOT open every post with 我觉得 / 没想到 / 真的.

Do not over-polish. Real diners do not praise every dish. If THIS visit has mixed likes / so-so / dislikes, keep that difference. Do not upgrade everything into 每一道都令人惊艳 / 整体体验无可挑剔 / 强烈推荐 / 性价比超高.
GOOD: 整体都蛮好吃，冬阴功是我最喜欢的，另一道就比较一般。
Keep the diner's own attitude scale:
- like → 这道我下次应该还会点
- ordinary → 味道还可以，但没有特别惊艳
- dislike (from their note) → 对我来说有点咸，下次应该不会再点
- pricey but ok → 价格确实不算便宜，不过份量和味道还可以
- personal taste → 泰奶还是太甜了，这个真的看个人能不能接受
Do not change their real evaluation to make the brand look better.
Platform-banned attack wording (贵/难吃/踩雷/不推荐/失望 as raw copy) still follows the existing neutralization rule: keep the meaning as personal judgment, never as false praise.

Spoken, slightly irregular Chinese is allowed when it fits: 真的很好吃 / 有点意外 / 我直接吃光 / 这道可以 / 蛮推荐的 / 说实话 / 哈哈 / 下次还会点 / 吃完才发现 / 这个真的很可以 / 对我来说有一点咸.
Use these only when the context is natural. Do not force slang, 哈哈哈哈, or extra emoji just to sound “real”. No deliberate typos or broken grammar.

Prefer concrete observations over empty adjectives. Avoid dumping 正宗 / 地道 / 美味 / 精致 / 惊艳 / 高级 / 独特 / 令人难忘 / 极致 / 绝绝子 unless the customer's own words support that tone.
Write what they actually noticed: 酸/甜/辣/咸, 汤底浓不浓, 虾大不大, 蟹肉多不多, 蛋嫩不嫩, 米饭干湿, 有没有锅气, 上菜快慢, 要不要排队, 服务员是否有耐心, 菜单有没有中文, 好不好找, 还会不会再点.
Only when THIS visit's notes, selected taste words, or visible photo facts support it. Never invent 虾很大 / 汤底很浓 / 上菜慢 to sound specific.
BAD: 冬阴功非常美味，口感层次丰富。
GOOD (only if evidence supports): 冬阴功的汤底比较浓，酸辣味很明显，虾也蛮大的。

Do not invent flaws for authenticity. Small downsides only if the customer provided them.

Do not always go 餐厅介绍 → 菜品 → 环境 → 服务 → 性价比 → 总结. Pick the most natural opening from THIS visit: favorite dish, shopping scene, personal expectation, a real inconvenience, or a feeling. Stop when the share is done. Do not force a closing 总体来说非常值得推荐.
GOOD endings that are not summaries: 下次再来一定要把咖喱蟹肉点上。 / 吃完继续逛，刚刚好。 / 泰奶对我来说有点甜哈哈。

Mild human irregularity is good: mixed long/short sentences, a sudden short line, light repetition for tone, spoken connectors (蛮/有点/还是), jumping from one dish to another, result-then-reason, a feeling in the middle. Goal: natural, not tidy like an ad. Not low-quality or error-filled.

Forbidden AI-promo frames unless the customer themselves wrote that tone:
如果你正在寻找一家……那么……绝对值得加入你的曼谷美食清单
无论是……还是……都能满足……
从……到……，每一个细节都……
不得不说，这是一场……的味蕾盛宴
难怪成为众多游客……
这家餐厅用实力诠释了……
强烈推荐大家来打卡 / 答应我，一定要来试试 / 宝子们快冲

Style references (brand reference posts AND any consumer-review samples) are for HABITS only: first person, spoken rhythm, specific dish notes, mixed like/dislike, varied length and order, light emotion, personal taste, scene / queue / price / service / room when evidenced.
NEVER copy, rewrite, or stitch their sentences, metaphors, unique phrasing, or stories.

Before writing the caption, judge internally (do not print this list):
1) What does this diner actually want to share?
2) Which dish or moment is worth writing?
3) Any like / so-so / dislike in the evidence?
4) Any real price / queue / location / service detail?
5) What opening is most natural this time?
6) Short or long, from how much is worth sharing (existing length rule still applies; 2 sentences remain valid)?
7) Is this too similar in structure, length, or tone to the previous caption?
Final output must read like a consumer writing this meal in their own way — not an AI restaurant brochure.`;
}
