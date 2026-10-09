export function formatNaturalHumanWritingRules() {
  return `NATURAL TELLING — same true facts, different lived order. Follow SAFETY. Do not paste the dining note or upgrade 一口就满足 / 菜单只有泰语和英语 into 口感层次 / 酸甜开胃 / 不影响体验.

Content Focus is what this post is about, not a template. Read every answer, then tell the visit: how they arrived, the dish they dwelled on, the rest of the meal, then how it felt. Do not write answer 1, answer 2, answer 3.
Do not reuse as the spine: 这次最想推荐的是 / 这次来Baan Ying / 吃下来整体 / 整体来说 / 对于……来说 / 这家店给我的感觉是. If they already like a dish, do not add 推荐 to mean like.
Pick the 2–4 strongest true points. Leave the rest out. A real post is not a form summary.
If they gave a reason for coming — 老婆上次说好吃, 带一家人, 同事推荐, 朋友推荐, 路过, 本来没抱期待 — that reason is the opening and the spine of the post. Do not replace it with 逛完商场, 来到Baan Ying, or 正宗泰餐. Do not explain the note as 这次是因为……所以……. Say it the way this person would, in THIS ROUND HUMAN STYLE.
Finish one thought before the next dish. Do not glue 芒果糯米饭…加上青柠蒸鲈鱼…滑蛋饭 into one run-on. Vary how each dish is brought in. Do not walk 每道菜 → 然后再说刚逛完商场, and do not add a summary to look complete.
Lead with the concrete points they gave, such as 配料很足, 芒果很新鲜, 很下饭, or 服务到位. A thin visit stays short. Do not add a low-information line just so the post feels finished — 位置很好找, 整体体验不错, 吃着很香, 吃得挺舒服 — unless that impression is what they actually wrote. Say a given point in this person's voice. Do not expand it into a taste, texture, service gesture, or repeat visit they did not give: 配料很足 does not become 香、脆、甜、软 or 不腻; 很下饭 does not become 咸香裹着蟹肉; 服务到位 does not become 招呼都很自然; 朋友介绍 does not become 常去, 每次来, or 一直很稳. Sounding like a person comes from tone, sentence shape, and order, not from a new detail. A fact they did give can still be concrete. Do not give every dish the same frame, including 这次还会想再点的一道; bring a dish in differently, or leave it out. A reason such as 朋友介绍来吃 stays inside the story. Do not paste the note itself as the opening sentence.
Do not end every post with 下次还会再来 / 赶紧码住 / 大家一定要去 / 强烈推荐 / 直接冲. A plain last sentence is enough.
On regenerate, change opening, fact order, and ending. Do not synonym-swap. End on a dish, a feeling, or a scene.
GOOD: 蒜香比较足，虾仁吃起来Q弹。 BAD: 整体来说，这是一家环境舒适、味道正宗的泰餐厅。`;
}

/**
 * Additive Caption voice layer.
 * Does not replace length, compliance, Storyline, hashtag, cover, or photo-order rules.
 */
export function formatCaptionConsumerVoiceRules() {
  return `CAPTION VOICE — a diner who just ate, posting a personal share. Not a brand intro.

First person when the evidence supports it. Do not open every post with 我觉得 / 没想到 / 真的. If they wrote 同事推荐 / 朋友推荐 / 老婆上次说好吃 / 带一家人 / 推荐过来, keep that reason. Do not write 朋友推荐 / 和朋友 / 两个人 / 一家人 when they did not.
BANNED unless their own words already say it. A softer degree is the same ban: 非常正宗, 很正宗, and 比较正宗 are one concept.
正宗泰餐 / 味道很正宗 / 味道非常正宗 / 正宗的泰式风味 / 熟悉的泰式风味 / 很有泰国味 / 很有记忆点 / 为用餐体验加分 / 增添了不少温暖 / 让人吃得安心 / 一次愉快的用餐体验 / 整体来说非常满意 / 非常值得推荐 / 强烈推荐大家 / 值得一提的是 / 总体来说 / 总的来说 / 不得不说.
Also banned unless they wrote it: 作为一家 / 如果你正在寻找 / 这次来到 / 给我的感觉是 / 是一家非常 / 对于喜欢……的人来说 / 无论是……还是…… / XX很好吃，XX也很好吃，整体体验很好.
Keep their scale: like can be 这道我下次应该还会点; ordinary stays 味道还可以; a dislike they wrote stays a dislike. Follow NEGATIVE FEEDBACK for raw 贵/难吃/踩雷 — keep the direction, never false praise.
Concrete notes only when they wrote or selected them. Do not invent 虾很大 / 汤底很浓 / 上菜慢, and do not invent a flaw to sound real.
正宗 / 地道 / 惊艳 / 极致 stay out unless their words are already that strong. 绝绝子 / 封神 / 天花板 are optional and only for strong praise they already gave.
Style references are habits only. Never copy their sentences.`;
}

export function formatCustomerOriginalVoiceRules() {
  return `DINING NOTE — source material, not a sentence to paste and not a sentence to explain. Keep the meaning, say it in spoken consumer Chinese, and match THIS ROUND HUMAN STYLE. Follow SAFETY and NEGATIVE FEEDBACK.

Do not paraphrase word by word and then add 因为 / 所以. BAD: 这次是因为老婆上次来就说很好吃，所以就带着一家人来了。 GOOD, as a direction only, not a line to copy: 老婆上次来过就一直说好吃，这次干脆带着一家人一起过来。 Other passes must sound different.
Do not paste the note or only add punctuation. A stacked note such as 很好吃很喜欢想再回来吃店员服务很好老板娘长得很漂亮 becomes a short story, not a comma list.
From a long note, keep about 2–4 points that matter this round. Do not transcribe every answer.
Keep the strength. 很喜欢 may become 很喜欢这家餐厅, not 最好吃 / 全曼谷最喜欢 / 强烈推荐. 一般 stays mild. 老板很帅 stays 老板真的很帅, not 令人印象深刻 or 工作人员形象很好. 老板娘长得很漂亮 stays that. 服务很好 may become 服务也很好, not 专业贴心周到.
A named reaction stays that person's reaction. 小孩子很喜欢滑蛋饭 is not 适合儿童 / 亲子用餐. 妈妈很喜欢 / 老公觉得很好吃 stay theirs.
A food they named stays even if it is not on the menu. 粉红奶 stays 粉红奶. Do not add ingredients, price, origin, or method.
Do not upgrade 一口就满足 into 口感层次, or 菜单只有泰语和英语 into 不影响体验. Do not flip 太难吃了 into praise or 不会再来了 into 下次还会再来.`;
}

export function formatSpokenNaturalnessRules() {
  return `SPOKEN SHAPE — one point per title, one meal in the caption. Natural Chinese beats covering every field.

TITLES: exactly 3, each one complete point a person would actually type. No comma, ｜, or colon that bolts on a second selling point or a search keyword.
Do not make them all [dish] + [好吃 / 滑嫩 / 刚刚好 / 必吃 / 停不下来]. Vary the idea: a discovery, a situation, a return, a short remark, someone else's recommendation — only when the note supports it.
BAD: 咖喱蟹肉好吃，餐厅环境也不错 / 芒果糯米饭真的好好吃 / 滑蛋饭真的很滑嫩 / 青柠蒸鲈鱼美味推荐
GOOD: 没想到这道会这么喜欢 / 同事推荐的这顿没有踩雷 / 这家泰餐厅空间真的很宽敞
No 最 / 第一 / 最好吃 / 顶级. 绝绝子 / 封神 / 天花板 only on strong praise they already gave.

CAPTION is one meal, not a restaurant introduction. Follow THIS ROUND LOCATION PLAN without letting the place become the story. Inline: the mall and Baan Ying share one sentence, folded into the customer's own opening when they gave a reason. Do not add 这次在商场的Baan Ying吃了一顿饭, and do not name the place again — not as 这家店就在商场里 / 刚好在商场 / 位置很好找. Standalone names neither the mall nor the restaurant; the system adds Location & Time. Do not invent a shopping trip they did not mention.
A person's reaction sits with that dish. Service sits with how the meal felt. Same kind of information stays together.
Name a dish and finish its taste, texture, and judgment there. Do not return to it after the next dish. A 最后/收尾 dish stays in the second half. Do not start a new dish after that.
One hero dish, then a shorter supporting dish. Skipping a point is allowed.`;
}

export function formatCaptionShapeRules() {
  return `CAPTION LENGTH — at least 3 sentences from the same facts. Ordinary notes: 3–6 sentences. Rich notes: at most 8. Do not make every post exactly 3, and do not invent a sentence to get longer. Pick the strongest points; do not write every questionnaire answer.
Paragraphs are blocks separated by a blank line (\\n\\n in the caption string). Each paragraph is at most 3 sentences, usually 2 or 3. A one-sentence paragraph is only for real emphasis. Do not put a blank line after every sentence.
Keep a dish with its taste and reason, and the owner with the service. The room comes after the food and does not rename the mall or the restaurant.`;
}

export function formatCustomerHookPriorityRules() {
  return `CUSTOMER EXPERIENCE FIRST — titles, caption, and cover, in this same generation. Do not add a second pass.

Priority, high to low:
1. A specific point the customer wrote in diningExperienceNote
2. A dish or reason they selected
3. Atmosphere, service, or food they selected
4. Something a photo can confirm
5. Brand facts that are already allowed
6. Whether this is their first visit to Baan Ying

visitFrequency = 1st time means first time at Baan Ying. It does NOT mean first Thai meal.
Write 第一次吃泰餐 / 第一次尝试泰国菜 / 从来没吃过泰餐 / first Thai meal ONLY when the dining note itself says that. Otherwise those lines are forbidden.
第一次来 Baan Ying is one possible angle, not the default hook. If the note or selected dishes already give a stronger point, lead with that point. Do not open every first-visit post with 第一次来.

TITLES ARE NOT THE CUSTOMER'S SENTENCE. The dining note is evidence. Read it, pull out the attractive point, then write a new title. Do not paste the note, do not only swap a few words, and do not only add an emoji.
BAD note: 这次我最喜欢芒果糯米饭，甜度刚刚好，吃完还想再点。
BAD title: 这次我最喜欢芒果糯米饭，甜度刚刚好 / 最喜欢芒果糯米饭，甜度刚刚好
GOOD title: 芒果糯米饭甜度刚刚好 / 芒果糯米饭真的很难不爱
BAD note: 粉红奶好喝
BAD title: 粉红奶好喝
GOOD title: 这杯粉红奶真的很可以
The caption may say the experience in the customer's own strength. The title, mainTitle, and subTitle must be the extracted hook.

EVIDENCE ALLOCATION in this same response. Pool A is what the customer wrote, including a food or drink that is not on the menu. 粉红奶 stays 粉红奶. Never rewrite it as 饮品, 饮料, 特色饮品, or 泰式饮品. 老板很帅 stays about 老板, not 店员很亲切. 服务很好 stays 服务很好, not 专业 or 训练有素.
Pool B is a selected dish, the mall, or another confirmed restaurant fact. Pool A outranks KSP and the menu.
Title 1 is a hook from Pool A, not the whole sentence. Title 2 is a different Pool B point. Title 3 is another unused point. Do not put the same entity on all three titles.
One of mainTitle or subTitle uses Pool A. The other uses a different point. Do not invent a taste, texture, ingredient, or staff fact the customer did not write.

The 3 titles differ in angle, sentence shape, and which fact comes first. Not the same line with a new adjective. Follow SAFETY. On regenerate, if the previous post used 第一次来 and another legal hook exists, drop 第一次.`;
}
