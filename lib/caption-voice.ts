export function formatNaturalHumanWritingRules() {
  return `NATURAL HUMAN WRITING — titles AND caption. Additive. Does not replace factuality, sentiment, party-size, or Content Focus.

Goal: same true facts, different lived telling. Change opening, information order, sentence shape, dish wording, sentence length, density, where emotion appears, ending, and rhythm.
FORBIDDEN: same template + different adjectives.

1) Content Focus is WHAT this post is mainly about. It is NOT a fixed article template.
Write in this order: real customer input → extract facts → pick the angle worth telling this round → organize naturally → THEN check Content Focus.
FORBIDDEN: Content Focus → fill a template → drop in customer facts.
The same Focus must still be tellable in completely different wording.

2) Change the narrative path every generation. Do not repeat the last path.
Paths: start from the favorite dish / a concrete detail / the dining feel / the scene / result then reason / one dish leading to another / atmosphere or service leading to food / mall or convenience leading to food / the customer's own written moment / no summary, end on the last fact.
Do not force odd syntax just to look different.

3) These cores must not become the default, and consecutive generates must not reuse the same one as opening or spine:
这次最想推荐的是…… / 这次比较想推荐的是…… / 这次最喜欢的是…… / 这次来Baan Ying…… / 吃下来整体…… / 整体来说…… / 整体体验下来…… / 食物整体…… / 对于……来说…… / 喜欢泰餐的快来…… / 想吃……的朋友可以…… / 这家店给我的感觉是……
Especially forbidden back-to-back: “这次最想推荐的是 + 菜名 + 评价”.

4) Dish wording must vary. Do not always “这次最想推荐的是X。X很好吃……”
Use when evidenced: X这次真的有记住我 / 点的几道里面，我比较喜欢X / X的……比较明显 / 如果只选一道，我会选X / 这次吃下来，X比较有记忆点 / X是我这次还会想再点的一道 / describe X without announcing 推荐.
If they already said they like it, do not repeat 推荐 to mean like.

5) Real UGC rhythm: mix short / medium / a few longer sentences, spoken connectors, natural pauses, uneven paragraphs.
Allowed when natural: 我觉得 / 其实 / 还蛮 / 比较 / 刚好 / 没想到 / 这次 / 真的 — do not use the same spoken words every post.
Do not fake authenticity with typos, broken grammar, or over-slang.

6) Pick 2–5 most valuable true points. Do not list every answer.
Do not mechanically: 地点 → 第一次 → 环境 → 服务 → 菜1 → 菜2 → 支付 → 总结.
Allowed: one dish only / two dishes in a row / one atmosphere line / no closing summary / location woven in / end on a concrete fact.
Do not add a summary to make the post “complete”.

7) Endings must change. Do not always 吃下来整体还不错 / 整体体验很好 / 值得推荐 / 喜欢泰餐的可以来试试 / 大家可以去试试.
End on a dish, a concrete feeling, a scene, a personal judgment, or just stop.
GOOD: 这道我下次应该还会点。 / 刚好在centralwOrld，想吃泰餐的时候也比较方便。 / 滑蛋饭这次还蛮喜欢的，口感很嫩。

8) Length and density must change (Short → Long → Medium → Short), not 145→147→151. Thin evidence stays short. Never invent to get longer.

9) Compare the last 3 generations: contentFocus / openingPattern / firstSentencePattern / informationOrder / dishEntryPattern / sentenceRhythm / endingPattern / informationDensity / lengthLevel.
If opening + information order + dish wording + ending is highly similar to the last post, RESTRUCTURE. Do not synonym-swap.
BAD next: 感受 → 环境 → 菜1 → 菜2 → 换形容词 → 总结
GOOD next: 菜1 → 菜1具体特点 → 菜2 → 商场场景  OR  环境 → 用餐感受 → 菜1 → 自然结束

10) Prefer concrete facts over AI summaries.
GOOD: 蒜香比较足，虾仁吃起来Q弹。 / 店里刚翻新过，看起来比较新。
BAD: 整体来说，这是一家环境舒适、菜品丰富、味道正宗的泰餐厅。 / 餐厅整体环境经过升级后，为顾客提供了更加舒适的用餐体验。

11) Naturalness comes from re-ordering true facts only. Never add party size, companions, a shopping trip, mood, queue, service details, taste, price feeling, room details, 下次还会来, 一定会推荐, or any experience the customer did not give.

FINAL CHECK before return:
1) Does it read like a diner who just ate and is sharing?
2) Obvious template sentence?
3) Same opening family as any of the last 3?
4) Same information order as any of the last 3?
5) Reused 这次最想推荐的是?
6) Every sentence too tidy?
7) Only swapped adjectives?
8) Mechanically listed every customer answer?
9) Forced a summary for completeness?
10) Any unsupported fact?
If 2–8 is yes: restructure the caption and titles. Do not synonym-replace.
Target: facts stay the same; saying, order, rhythm, emphasis, opening, and ending can all change. Each draft should feel like a different person writing a real share, not random text.`;
}

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
我觉得 / 我最喜欢的是 / 本来以为……结果…… / 这道真的…… / 吃完才发现…… / 对我来说…… / 如果再来我应该还会点…… / 这次点了…… / 没想到…… / 说实话…… / 整体下来……
Do not write 朋友推荐来的 / 和朋友 / 两个人 / 一家人 unless the customer explicitly said that.
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
6) Does this follow THIS ROUND length band without inventing?
7) Is this too similar in structure, opening, fact order, or length to the previous caption?
8) If they selected several points, did I describe more than one in complete sentences — not a tag list?
9) Is every sentence natural Chinese, not glued keywords (就是食材新鲜度感觉提升空间)?
Final output must read like a consumer writing this meal in their own way — not an AI restaurant brochure.`;
}
