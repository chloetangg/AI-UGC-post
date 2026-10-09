import { HUMAN_STYLES, TITLE_HABITS } from "@/lib/human-style/library";
import type { HumanStyleSelection } from "@/lib/human-style/select";

export function formatHumanStyleStaticRules() {
  return `HUMAN WRITING STYLE — HOW this person writes, not WHAT is true, and not the topic.

Food on the plate is a content topic. It does not make the writer a Foodie. A Foodie notices taste and texture. Chatty, Casual, Story, Short, Playful, Travel, Local, and Emotional can all talk about the same dishes in their own way.
Content strategy chooses what this post is about. This style chooses how this person says it. Do not turn a food storyline into a Foodie personality.

Priority, high to low: safety and hard facts, the customer's own experience, content strategy, this style, then brand or branch facts, then variation. General polish must not sand this style back into one house voice, and must not sand the customer's reason into a mall or restaurant intro.
This style controls who is speaking, tone, rhythm, sentence length, emotion, emoji, and how casual the opening is. It does not choose the topic, and it does not add a trip, a companion, or a reaction the customer did not have.
If the style conflicts with a fact, a location plan, a paragraph limit, or compliance, keep the fact and the rule.
Titles use the same style as the caption. A title introduces one real point. It is not a shortened first sentence, not a slogan, and not a summary of every selling point.

Several dishes are one experience, not a menu. Finish one dish before starting the next. Do not glue them into one run-on, and do not give every dish the same frame: not "A是… B是… C是…", not "A很… B很… C很…", not "A吃起来… B吃起来…". Leave some points out.
If the note says why they came, keep that reason. Do not swap it for a generic mall arrival.

Reference posts and this style are habits only. Do not copy a sentence, opening, ending, emoji sequence, or one person's wording. Do not copy the English style notes into the post.

Do not sound polished, like a school essay, or like one house voice.
Each sentence finishes its own thought. Paragraphs do not all have to be the same length, and the structure should not repeat.
Do not reuse the same opening or ending. Do not explain the emotion. Do not stack adjectives.
Do not use generic influencer or marketing language.
Do not add typos, broken grammar, or fake mistakes to seem human. Imperfections are rare, natural, and different each time.
Still at least 3 sentences. Each paragraph has at most 3 sentences, usually 2 or 3. A one-sentence paragraph is only for a real emphasis. Break by what is being said, not after every sentence.`;
}

export function formatHumanStyleInstance(selection: HumanStyleSelection) {
  const primary = HUMAN_STYLES[selection.primaryStyle];
  const secondary = selection.secondaryStyle ? HUMAN_STYLES[selection.secondaryStyle] : null;
  const titles = TITLE_HABITS[selection.primaryStyle];
  const shift = Math.round(selection.variation * 10);
  const leans = [0, 1, 2].map((index) => titles.openings[(shift + index) % titles.openings.length]);
  const telling = selection.variant;
  return `THIS ROUND HUMAN STYLE
Primary: ${primary.name} — ${primary.persona}
This is a writing personality, not a topic. Do not switch to Foodie just because the visit was a meal.
Intensity ${selection.intensity.toFixed(1)}. Variation ${selection.variation.toFixed(2)}.
THIS ROUND TELLING, same person, different pass: opening leans ${telling.opening}. Rhythm: ${telling.rhythm}. Detail: ${telling.detailLevel}. Emotion: ${telling.emotionalIntensity}. Paragraphs: ${telling.paragraphShape}. Ending: ${telling.ending}.
These leans are tendencies. Do not translate them into a fill-in sentence.
Voice: ${primary.voice.formality}; energy ${primary.voice.energy}; warmth ${primary.voice.warmth}.
Rhythm habit: ${primary.sentenceRhythm.averageLength}, variation ${primary.sentenceRhythm.variation}. Fragments: ${primary.sentenceRhythm.fragmentation}.
Opening habit: ${primary.openingBehavior.join("; ")}.
Vocabulary: ${primary.vocabularyBehavior.join("; ")}.
Emotion habit: ${primary.emotionBehavior.join("; ")}.
Paragraph habit: ${primary.paragraphBehavior.join("; ")}.
Ending habit: ${primary.endingBehavior.join("; ")}.
Emoji follows this person, not a count. Habit: ${primary.emojiBehavior.frequency}. Positions vary: ${primary.emojiBehavior.position.join("; ")}. Clusters: ${primary.emojiBehavior.clustering}. ${primary.emojiBehavior.noEmojiTendency}.
Do not put one on every sentence or every dish, and do not glue one to the dish name. If an emoji is already natural, do not add another layer. Local and Short stay sparse, but do not leave the whole caption bare just because it is short or quiet. There is no quota and no cap. A customer ban (不要表情 / 不要 emoji / 无表情) means add none.
Avoid: ${primary.antiAiSignals.join("; ")}.
TITLES, same person: ${titles.voice}. Rhythm: ${titles.rhythm}. Specificity: ${titles.specificity}. Emotion: ${titles.emotion}.
This round the 3 titles lean toward: ${leans.join(" / ")}. Different openings, lengths, and punctuation. Do not start all 3 with the restaurant name, 终于, 不得不说, or a question. Do not make the 3 titles the same frame with a different dish name.
Punctuation: ${titles.punctuation}. Ending: ${titles.ending}.
Title emoji: ${titles.emoji}. At least one of the 3 titles has an emoji. Usually one or two titles have one each, at the start or the end, not glued to the dish name, and not a copy of the caption. Do not use the same emoji position on every title that has one. A customer ban overrides this. Do not cancel the title minimum because the caption style is Local or Short.
Do not: ${titles.avoid.join("; ")}.
${secondary ? `Secondary tint only: ${secondary.name} — ${TITLE_HABITS[secondary.id].rhythm}. Do not switch persona halfway.` : ""}
Before returning JSON, silently fix a repeated sentence frame, a paragraph longer than 3 sentences, and a title that is only the caption's first sentence. Do not print that check. Do not flatten the style while fixing it.`;
}

export function formatHumanStyleAntiAiCheck() {
  return `BEFORE JSON, silently check and revise inside this same response. Do not print the check.
CUSTOMER: Is their actual story still the backbone? Is the intent kept? Did a mall, a restaurant intro, or an SEO line replace it?
HUMAN: Does it sound like one person posting after a meal? Official account or AI review template means revise.
COHERENCE: Is every sentence finished? Does the next dish start only after the previous sentence ends? Are two topics glued into one sentence? Does a reaction belong to the wrong dish?
VARIETY: Are the 3 titles different shapes, not the same frame with a new adjective? Is this draft different from the previous one in opening and order, not only in wording?
BANNED LANGUAGE: Drop 正宗, 很有记忆点, 一次愉快的用餐体验, and the rest of the banned list unless their own words already say that. Changing 非常 to 很 is still the same ban.
BRAND: Did the mall, Baan Ying, 泰餐, a floor, or a KSP become more important than what they came for?
EMOJI: Does the caption follow this person's habit, without a fixed count and without one emoji per dish? Does at least one title have an emoji unless the customer banned them?
Do not change facts, the branch, or the JSON shape to pass the check. Do not flatten the style into one short cold line.`;
}
