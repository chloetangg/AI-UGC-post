export function formatNaturalHumanWritingRules() {
  return `NATURAL HUMAN WRITING — titles AND caption. Additive. Does not replace factuality, sentiment, party-size, Content Focus, or CUSTOMER DINING NOTE.

Goal: same true facts, different lived telling. Change opening, information order, sentence shape, dish wording, sentence length, density, where emotion appears, ending, and rhythm.
The dining note is source material. Segment it and rewrite it into natural sentences. Do not paste it verbatim, and do not upgrade 一口就满足 / 菜单只有泰语和英语 into 口感层次 / 酸甜开胃 / 不影响体验.
FORBIDDEN: same template + different adjectives.

1) Content Focus is WHAT this post is mainly about. It is NOT a fixed article template.
Write in this order: real customer input → extract facts → pick the angle worth telling this round → organize naturally → THEN check Content Focus.
FORBIDDEN: Content Focus → fill a template → drop in customer facts.
The same Focus must still be tellable with a different structure. Do not drop the customer's real points just to look different. Rewrite them; do not paste the raw note.

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
Use these only when the context is natural. Do not force slang or 哈哈哈哈 just to sound “real”. Caption still needs at least 2 list emojis that fit this copy; do not dump more to look lively. No deliberate typos or broken grammar.

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

export function formatCustomerOriginalVoiceRules() {
  return `CUSTOMER DINING NOTE — segment, then rewrite. Additive. Does not replace compliance neutralization, party-size, or official location facts.

The "Tell us more about your dining experience" note is RAW EXPERIENCE MATERIAL, not a finished sentence to paste into the caption.
Pipeline: understand the meaning → split information points → keep the 2–4 that matter for this Storyline / Content Angle → rewrite them into natural complete sentences → weave them into a personal dining story.
The reader should feel the diner wrote this after eating. Not: the AI rearranged questionnaire answers.
Priority: real experience > natural wording > completeness.

1) Do NOT paste the note verbatim, and do NOT only add punctuation.
BAD source: 很好吃很喜欢想再回来吃店员服务很好老板娘长得很漂亮
BAD caption: 很好吃很喜欢想再回来吃店员服务很好老板娘长得很漂亮
BAD caption: 很好吃，很喜欢，想再回来吃，店员服务很好，老板娘长得很漂亮。
That still reads like a survey dump.

2) Segment stacked, unpunctuated input before writing.
Example points from that note: 食物口味 很好吃 / 个人感受 很喜欢 / 再访意愿 想再回来吃 / 服务 店员服务很好 / 人物印象 老板娘长得很漂亮
Missing punctuation does NOT mean the customer wants that format kept. Punctuation, word order, and sentence shape may change. Keep the real information and the real feeling.
Trigger this split when the note has almost no punctuation, several phrases run together, and mixes food, service, room, people, and emotion.

3) You may add a subject, connectors, and spoken tone; split into several sentences; merge repeated meaning; reorder; turn shorthand into natural Xiaohongshu consumer Chinese; put different topics in different sentences; drop duplicates that add no information.
GOOD: 这次吃下来真的很喜欢，味道很合口味，已经开始想下次再来了。店员服务也很好，老板娘也很漂亮，整个用餐过程都很舒服。
GOOD short: 味道很好，整体吃下来很喜欢，已经想再来一次了。店员服务很不错，老板娘也很漂亮。

4) Do not cram every topic into one list sentence.
Food → a food sentence. Service → a service sentence. Room / person / feeling → their own sentence.
BAD: 食物很好吃、店员服务很好、老板娘很漂亮、环境很好、下次还想来。
Make them one dining story with a natural order.

5) Do not keep every point. A note with 5–6 scattered points should contribute about 2–4.
Do not change the customer's meaning. Do not invent an experience they did not express. Do not upgrade 一般 to 很好. Do not add taste, room, or service details they did not give. Do not invent just to make the post feel complete.

6) A mild feeling may be rewritten, not escalated, and not turned into an objective claim.
很喜欢 may become 这次吃下来真的很喜欢 / 整体很合我的口味 / 这顿饭吃得很开心.
Do NOT escalate into 这是我吃过最好吃的泰餐 / 全曼谷最喜欢的一家 / 强烈推荐大家都来.
Keep who liked what. 小孩子很喜欢滑蛋饭 means the child liked that dish.
GOOD: 滑蛋饭是这次比较喜欢的一道，小朋友也吃得很开心。 / 这次点的滑蛋饭，小朋友吃得很喜欢，我自己也觉得这道很不错。
BAD: 这道菜适合儿童。 / 儿童必点。 / 很适合带孩子来。 / 亲子用餐首选。 / 小孩子很喜欢，所以非常适合亲子家庭。
妈妈很喜欢 / 老公觉得很好吃 / 朋友一直说好吃 stay that person's reaction. Do not invent a new judgment.
服务很好 may become 服务也很好，吃饭的时候不用自己操心太多. It must not become 服务非常专业、贴心、周到.
老板娘长得很漂亮 stays 老板娘也很漂亮. It must not become 老板娘亲切漂亮，给人留下很深的印象.
Each point needs a reason to sit where it sits. 滑蛋饭很好吃，小孩子很喜欢 is connected. 服务很好。刚好在centralwOrld。 is not.
When the location plan puts the place in the story, that scene opens the visit and is not added again after the food. Otherwise leave the place out. Then what they ate, how it tasted, who reacted, and how the meal felt.
Before writing, judge internally and do not print it: who is named, who liked or disliked what, which dish, feeling versus fact, what to split, what to merge, and whether the wording still means what they said.

7) Concrete notes stay at the same strength. Rewrite the sentence; do not upgrade the claim.
GOOD source: padthai依旧好吃，一口就满足
GOOD: Pad Thai依旧好吃，一口下去就很满足。
BAD: Pad Thai酸甜开胃，丰富的口感层次让人一口接一口，整体味道令人非常满意。
GOOD source: 菜单只有泰语和英语，多花点时间才能看明白
GOOD: 菜单只有泰语和英语，第一次看还真的要花一点时间。
BAD: 今天来打卡这家超有特色的泰式餐厅！虽然菜单只有泰语和英语，但完全不影响体验。

Spoken texture may stay: 真的还不错 / 没想到还蛮好吃 / 这个我会再吃 / 刚好逛到这里就进来了 / 就是有点辣.
Do not swap these for 高级 / 精致 / 惊艳.

Do NOT add blogger voice unless the customer wrote it: 今天带大家来 / 作为一个泰餐爱好者 / 不得不说 / 这家店真的让我惊艳了 / 如果你也喜欢……千万不要错过 / 答应我一定要来试试 / 狠狠安利 / 闭眼冲 / 宝子们 / 曼谷必吃 / 私藏宝藏店 / 天花板 / 绝绝子 / 一整个爱住.

No forced 开头吸引→店铺介绍→菜品→推荐→总结→CTA.
2–4 natural sentences are enough when the note is short.

Harsh attacks still follow neutralization: keep the judgment direction, never rewrite 太难吃了 into 味道很特别 or 不会再来了 into 下次还会再来. Mild notes such as 就是有点辣 stay at that strength.

Never invent wow, layers, must-visit, or a full restaurant review the customer did not write.`;
}

export function formatSpokenNaturalnessRules() {
  return `SPOKEN CHINESE FIRST — titles AND caption. Additive. Natural word order beats covering every field.

Do not pack place + dish + keyword + extra fact into one sentence just to satisfy a checklist.
Priority: real experience > natural Chinese > story order > completeness > length.

TITLES — exactly 3. Each title is one complete, attractive sentence about ONE thing worth sharing: a dish that fit, a convenient place, a roomy room, a memorable dish, eating Thai food after shopping, or one real memory.
A title is not two selling points glued together.
FORBIDDEN comma splice of two claims: 青咖喱牛肉后劲足，但不腻 / 支付宝方便，吃泰餐更省心 / 咖喱蟹肉好吃，餐厅环境也不错 / 餐厅宽敞，咖喱蟹肉很满足.
Also forbidden: ｜ or a colon used only to bolt a second selling point or a search keyword onto the sentence.
GOOD: 青咖喱牛肉越吃越喜欢 / 在曼谷吃泰餐支付宝也能直接用 / centralwOrld这家泰餐厅空间真的很宽敞 / 咖喱蟹肉是我吃了还想再点的一道.
If a place appears, it must serve that one point: centralwOrld 3楼这家泰餐的咖喱蟹肉很合口味. Not 曼谷美食｜咖喱蟹肉很合口味.
If the sentence is already complete, do not add more search keywords. One title, one core. 支付宝方便 + 吃泰餐 becomes 在曼谷吃泰餐支付宝也能直接用, not two clauses.
No 最 / 第一 / 最好吃 / 封神 / 顶级.

ONE VISIT — the caption is one meal the person is remembering. Plan that story first, then place the facts inside it.
The line is: where this meal happened, what they ordered, how it tasted, who reacted, how the meal felt.
Do not complete separate tasks: 菜品介绍 → 客户评论 → 餐厅介绍 → 服务评价 → 地点介绍.
When this round's location plan puts the place in the story, open with that scene, once: 这次逛centralwOrld的时候刚好去了Baan Ying，点了几道泰餐，其中滑蛋饭是我比较喜欢的一道，没想到小朋友也特别喜欢。服务也很好，整个吃饭过程比较轻松。
BAD: 滑蛋饭很好吃。小孩子很喜欢。刚好去了Baan Ying。服务很好。刚好在centralwOrld。
If the restaurant or the mall is already in that opening, do not introduce it again. 刚好去了Baan Ying and 刚好在centralwOrld are the same fact said twice.
A person's reaction sits with that dish: 这次点的几道里面，我比较喜欢滑蛋饭，没想到小朋友也特别喜欢。 Not 滑蛋饭很好吃。小孩子很喜欢。刚好去了Baan Ying。
Service sits with how the meal went: 服务也很到位，整个吃饭的过程比较轻松。 Not in the middle of the dishes.
Standalone location plan: do not add the mall or Baan Ying just to complete a checklist. Tell the meal. The system adds Location & Time.
Each sentence needs a reason to follow the one before it. If deleting a sentence changes nothing, it was stuffed in. Do not finish the food, then suddenly add the restaurant name, then the service, then the mall.
After drafting, ignore the brand names and read it again. It still has to sound like one person telling the meal. If it sounds like finished tasks, rewrite the whole caption.

CLOSING FACTS STAY LATE. If the evidence says 最后 / 最后点了 / 最后吃了 / 收尾 / 作为结尾 / 最后再来 / 甜点收尾 / 吃完刚好 / 完美结束, that item belongs in the second half, usually the last dish stretch.
BAD: 咖喱蟹肉很好吃，再来一份芒果糯米饭，甜而不腻，完美收尾。滑蛋饭也是这次的选择之一。
GOOD: 这次在Baan Ying点了咖喱蟹肉，味道很合我的口味。滑蛋饭也很简单耐吃，整体味道比较浓郁。最后用芒果糯米饭收尾，甜而不腻，粘度也刚刚好。
Never: A → 最后吃B → then a new dish C.

PLACE — follow THIS ROUND LOCATION PLAN. Inline: both the mall and Baan Ying, once, inside the meal. Standalone: do not stuff them in; the system adds Location & Time. Say that place once. The system Location & Time block at the end is not a repeat.
GOOD: centralwOrld 3楼的这家Baan Ying，咖喱蟹肉是我吃了还会想再点的一道。 / 这次逛centralwOrld顺便去了3楼的Baan Ying，咖喱蟹肉是我吃了还会想再点的一道。
BAD: 咖喱蟹肉是我这次还会想再点的一道。去了3楼的Baan Ying。
BAD: 咖喱蟹肉很好吃。Baan Ying在centralwOrld 3楼。 / 滑蛋饭味道不错。centralwOrld 3楼。 / 餐厅环境很好。Baan Ying 3楼。
If the story does not need the address, leave mall, floor, and hours to the system Location & Time block. Do not invent a shopping trip to justify the address.
After centralwOrld 3楼的这家Baan Ying, do not add Baan Ying就在centralwOrld 3楼.

DISH CONTINUITY — when a dish is first named, finish its taste, texture, and judgment there. Do not return to it after the next dish has started.
BAD: 芒果糯米饭。接着咖喱蟹肉。菠萝炒饭。芒果特别新鲜，搭配糯米口感完美。
GOOD: 芒果糯米饭，芒果特别新鲜，搭配糯米口感刚刚好。接着咖喱蟹肉。然后菠萝炒饭。
Several notes about one dish stay in that same stretch. After the next dish starts, do not jump back.

DISH WEIGHT — several dishes are not equal paragraphs. Main dish → a shorter supporting dish → a closing dish if the evidence has one.
BAD: 咖喱蟹肉很好吃。芒果糯米饭很好吃。滑蛋饭也很好吃。
GOOD: 这次在Baan Ying最喜欢的还是咖喱蟹肉，味道很合我的口味。滑蛋饭简单但很耐吃。最后用芒果糯米饭收尾，甜而不腻。
Skipping a dish, a reason, the room, or the service is allowed. 2–3 sentences are allowed.

Before writing, judge internally and do NOT print this list:
1) the main experience 2) the hero dish 3) supporting dishes 4) any 最后/收尾/逛街后 relation 5) what comes first 6) what comes last 7) whether place belongs in the story 8) which sentence can carry the place 9) which note points to rewrite 10) whether this sounds like a person after the meal.
If a sentence has the right facts but a Chinese speaker would not say it that way, rewrite the order. Do not keep an awkward line just because it satisfies a rule.`;
}
