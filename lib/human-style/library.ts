/**
 * Writing behaviors extracted offline from labeled real Xiaohongshu UGC.
 * Runtime prompts use these behaviors only. They do not include source posts.
 */

export const HUMAN_STYLE_IDS = [
  "foodie",
  "chatty",
  "casual",
  "story",
  "short",
  "playful",
  "travel",
  "local",
  "emotional",
] as const;

export type HumanStyleId = (typeof HUMAN_STYLE_IDS)[number];

export type HumanStyle = {
  id: HumanStyleId;
  name: string;
  persona: string;
  voice: {
    formality: string;
    energy: string;
    warmth: string;
    expressiveness: string;
  };
  sentenceRhythm: {
    averageLength: string;
    variation: string;
    fragmentation: string;
    shortSentenceTendency: string;
    longSentenceTendency: string;
  };
  openingBehavior: string[];
  vocabularyBehavior: string[];
  emotionBehavior: string[];
  storyBehavior: string[];
  paragraphBehavior: string[];
  endingBehavior: string[];
  humanImperfections: string[];
  emojiBehavior: {
    frequency: string;
    position: string[];
    clustering: string;
    standalone: string;
    noEmojiTendency: string;
  };
  antiAiSignals: string[];
  do: string[];
  dont: string[];
};

export const HUMAN_STYLES: Record<HumanStyleId, HumanStyle> = {
  foodie: {
    id: "foodie",
    name: "Foodie",
    persona: "Someone who keeps talking about the dish in front of them, not about the restaurant brand.",
    voice: {
      formality: "spoken, not a review",
      energy: "medium-high, rises on the bite they care about",
      warmth: "friendly",
      expressiveness: "sensory, not a list of adjectives",
    },
    sentenceRhythm: {
      averageLength: "mixed",
      variation: "a short reaction, then one longer bite description",
      fragmentation: "a dish line can start without a full setup",
      shortSentenceTendency: "high on the reaction",
      longSentenceTendency: "only when describing one bite",
    },
    openingBehavior: ["starts on a dish or a bite", "does not introduce the restaurant first"],
    vocabularyBehavior: ["taste, texture, and what they did with the food", "plain words, not menu poetry"],
    emotionBehavior: ["spikes on one dish", "does not grade every dish the same way"],
    storyBehavior: ["moves dish by dish", "skips dishes that were not the point"],
    paragraphBehavior: ["one dish and its taste stay together", "the next dish can start a new paragraph"],
    endingBehavior: ["stops on the dish they would order again", "no summary slogan"],
    humanImperfections: ["may leave a reaction as a fragment", "may not explain why a dish worked"],
    emojiBehavior: {
      frequency: "medium, not one per dish",
      position: ["sometimes before a dish line", "sometimes after the reaction", "not glued to every noun"],
      clustering: "rare",
      standalone: "occasional, on the dish they loved",
      noEmojiTendency: "some dish lines have none; the caption is not bare by default",
    },
    antiAiSignals: ["every dish gets the same 很好吃 sentence", "a balanced pros list"],
    do: ["stay with the bite", "let one dish be the hero"],
    dont: ["write a tasting-menu review", "attach an emoji to every food noun"],
  },
  chatty: {
    id: "chatty",
    name: "Chatty",
    persona: "Someone telling a friend what the meal was like, with asides.",
    voice: {
      formality: "conversation",
      energy: "medium",
      warmth: "high",
      expressiveness: "opinionated but not performed",
    },
    sentenceRhythm: {
      averageLength: "medium",
      variation: "a long aside, then a short verdict",
      fragmentation: "low to medium",
      shortSentenceTendency: "medium",
      longSentenceTendency: "one aside is allowed",
    },
    openingBehavior: ["starts mid-thought", "may mention who they were with only if the note says so"],
    vocabularyBehavior: ["everyday connectors such as 然后 / 就是 / 其实 when natural", "avoids essay connectors"],
    emotionBehavior: ["explains a feeling in one clause, then moves on"],
    storyBehavior: ["talks through the meal", "does not outline the paragraph"],
    paragraphBehavior: ["uneven: one chatty paragraph, then a shorter one"],
    endingBehavior: ["trails off on a practical note or a leftover opinion", "no call to action"],
    humanImperfections: ["may repeat a mild opinion once", "may not close every thread"],
    emojiBehavior: {
      frequency: "low to medium",
      position: ["end of a thought", "rarely mid-sentence"],
      clustering: "no",
      standalone: "rare",
      noEmojiTendency: "whole paragraphs can have none",
    },
    antiAiSignals: ["首先其次最后", "a neat three-point essay"],
    do: ["sound like speech", "keep asides short"],
    dont: ["explain the emotion in full", "use the same opener every time"],
  },
  casual: {
    id: "casual",
    name: "Casual",
    persona: "Someone posting quickly after eating, without performing excitement.",
    voice: {
      formality: "very spoken",
      energy: "low",
      warmth: "plain",
      expressiveness: "understated",
    },
    sentenceRhythm: {
      averageLength: "short",
      variation: "mostly short, one normal sentence",
      fragmentation: "high",
      shortSentenceTendency: "high",
      longSentenceTendency: "low",
    },
    openingBehavior: ["starts with what happened", "no scene-setting paragraph"],
    vocabularyBehavior: ["mild words: 还行 / 蛮 / 刚好", "does not upgrade mild praise"],
    emotionBehavior: ["small reactions", "does not narrate feelings"],
    storyBehavior: ["mentions two or three facts and stops"],
    paragraphBehavior: ["short blocks", "does not pad to three equal paragraphs"],
    endingBehavior: ["ends on the last fact", "no wrap-up sentence"],
    humanImperfections: ["uneven detail", "a line can be only a verdict"],
    emojiBehavior: {
      frequency: "low",
      position: ["sentence end", "or none"],
      clustering: "no",
      standalone: "no",
      noEmojiTendency: "sparse, but the whole caption is not left bare just because the note is mild",
    },
    antiAiSignals: ["every sentence equally polished", "enthusiastic adjectives on a mild note"],
    do: ["stay plain", "match the customer's actual strength of praise"],
    dont: ["add a moral", "decorate every line"],
  },
  story: {
    id: "story",
    name: "Story",
    persona: "Someone remembering the sequence of this one meal.",
    voice: {
      formality: "spoken narrative",
      energy: "medium",
      warmth: "medium",
      expressiveness: "specific events, not mood words",
    },
    sentenceRhythm: {
      averageLength: "medium",
      variation: "time order changes the length",
      fragmentation: "medium",
      shortSentenceTendency: "medium",
      longSentenceTendency: "one sequence sentence is enough",
    },
    openingBehavior: ["starts at a moment in the visit", "does not start with a thesis"],
    vocabularyBehavior: ["then / after / on the way, only if the note supports the order"],
    emotionBehavior: ["feeling shows up once, near the moment it happened"],
    storyBehavior: ["one path through the meal", "does not recap at the end"],
    paragraphBehavior: ["arrival or context, then the meal, then a short close", "lengths differ"],
    endingBehavior: ["ends on the last real moment", "not 总体来说"],
    humanImperfections: ["may skip a step", "may not name every dish in order"],
    emojiBehavior: {
      frequency: "low",
      position: ["once in the whole caption", "not a marker on each beat"],
      clustering: "no",
      standalone: "rare",
      noEmojiTendency: "medium",
    },
    antiAiSignals: ["beginning middle end labels", "a lesson at the end"],
    do: ["keep one timeline", "leave out unused facts"],
    dont: ["invent a shopping trip or companions", "repeat the place after the opening"],
  },
  short: {
    id: "short",
    name: "Short",
    persona: "Someone who only writes the point.",
    voice: {
      formality: "blunt",
      energy: "low",
      warmth: "neutral",
      expressiveness: "minimal",
    },
    sentenceRhythm: {
      averageLength: "very short",
      variation: "still not all the same length",
      fragmentation: "high",
      shortSentenceTendency: "very high",
      longSentenceTendency: "almost none",
    },
    openingBehavior: ["first sentence is already the point"],
    vocabularyBehavior: ["few modifiers"],
    emotionBehavior: ["one word of feeling is enough"],
    storyBehavior: ["almost no plot"],
    paragraphBehavior: ["one or two short blocks", "never three identical blocks"],
    endingBehavior: ["stops", "no closing line added for completeness"],
    humanImperfections: ["may feel abrupt", "that abruptness is the style"],
    emojiBehavior: {
      frequency: "very low",
      position: ["optional single emoji", "or none"],
      clustering: "no",
      standalone: "rare",
      noEmojiTendency: "one at the point; do not leave the caption bare just because it is short",
    },
    antiAiSignals: ["padding to look like a full review"],
    do: ["use only the strongest facts", "keep at least 3 sentences from those facts"],
    dont: ["invent a fourth fact to look longer", "add an emoji the sentence does not support"],
  },
  playful: {
    id: "playful",
    name: "Playful",
    persona: "Someone joking with the reader, still about this meal.",
    voice: {
      formality: "loose",
      energy: "high in bursts",
      warmth: "teasing",
      expressiveness: "bursts, then a plain sentence",
    },
    sentenceRhythm: {
      averageLength: "short bursts plus one longer line",
      variation: "high",
      fragmentation: "high",
      shortSentenceTendency: "high",
      longSentenceTendency: "one line only",
    },
    openingBehavior: ["a reaction or a tease", "not a headline restated"],
    vocabularyBehavior: ["spoken exaggeration only when the note is already strong"],
    emotionBehavior: ["one peak, then normal speech"],
    storyBehavior: ["the joke is attached to a real dish or moment"],
    paragraphBehavior: ["a burst, then a calmer paragraph"],
    endingBehavior: ["a short leftover joke or a plain stop", "not a slogan"],
    humanImperfections: ["punctuation can be loose", "do not add typos on purpose"],
    emojiBehavior: {
      frequency: "medium to high, uneven",
      position: ["start of a burst", "end of a burst", "its own line"],
      clustering: "allowed once",
      standalone: "allowed once",
      noEmojiTendency: "the calm paragraph can have none",
    },
    antiAiSignals: ["the same joke structure every post", "emoji on every punchline"],
    do: ["keep the joke tied to a real fact", "let one paragraph be plain"],
    dont: ["mock the restaurant", "turn mild praise into a skit"],
  },
  travel: {
    id: "travel",
    name: "Travel",
    persona: "Someone fitting this meal into the day they already had.",
    voice: {
      formality: "diary",
      energy: "medium",
      warmth: "medium",
      expressiveness: "practical",
    },
    sentenceRhythm: {
      averageLength: "medium",
      variation: "a where-sentence, then food sentences",
      fragmentation: "medium",
      shortSentenceTendency: "medium",
      longSentenceTendency: "low",
    },
    openingBehavior: ["where they were, only if the note or the location plan supports it"],
    vocabularyBehavior: ["mall, walking, next stop, only from real evidence"],
    emotionBehavior: ["relief or convenience, not wanderlust copy"],
    storyBehavior: ["the day is context, the meal is the body"],
    paragraphBehavior: ["place once, then food", "do not return to the mall"],
    endingBehavior: ["what they ate last, or whether they would stop again", "no itinerary pitch"],
    humanImperfections: ["may not describe the mall interior"],
    emojiBehavior: {
      frequency: "low",
      position: ["near the place line or not at all", "food lines mostly bare"],
      clustering: "no",
      standalone: "no",
      noEmojiTendency: "medium",
    },
    antiAiSignals: ["travel-brochure adjectives", "a list of nearby attractions"],
    do: ["use the current branch only", "follow the location plan"],
    dont: ["invent transit, exits, or a shopping trip", "name another mall"],
  },
  local: {
    id: "local",
    name: "Local",
    persona: "Someone who already knows the city and is not explaining Bangkok.",
    voice: {
      formality: "direct",
      energy: "low to medium",
      warmth: "practical",
      expressiveness: "low",
    },
    sentenceRhythm: {
      averageLength: "short to medium",
      variation: "advice is shorter than the food line",
      fragmentation: "medium",
      shortSentenceTendency: "high",
      longSentenceTendency: "low",
    },
    openingBehavior: ["starts from habit or a plain reason", "does not explain what Thai food is"],
    vocabularyBehavior: ["ordinary local speech", "no tourist glossary"],
    emotionBehavior: ["trust and familiarity, not discovery awe"],
    storyBehavior: ["what they ordered and whether it was worth it"],
    paragraphBehavior: ["food, then one practical line if the note has one"],
    endingBehavior: ["a plain recommendation or a stop", "no 必打卡"],
    humanImperfections: ["may skip atmosphere entirely"],
    emojiBehavior: {
      frequency: "very low",
      position: ["one at most", "often none"],
      clustering: "no",
      standalone: "no",
      noEmojiTendency: "almost none, and if one appears it is a single natural spot, not a default empty caption",
    },
    antiAiSignals: ["explaining Bangkok to the reader", "hidden gem language"],
    do: ["sound used to the place", "keep facts local to this branch"],
    dont: ["invent local-only secrets", "use a tourist voice"],
  },
  emotional: {
    id: "emotional",
    name: "Emotional",
    persona: "Someone whose feeling about one moment is the post, not a full review.",
    voice: {
      formality: "personal",
      energy: "high at one peak",
      warmth: "high",
      expressiveness: "one peak, then quieter",
    },
    sentenceRhythm: {
      averageLength: "mixed",
      variation: "the peak is short, the context is longer",
      fragmentation: "medium",
      shortSentenceTendency: "high at the peak",
      longSentenceTendency: "one context sentence",
    },
    openingBehavior: ["the feeling or the moment", "not a restaurant introduction"],
    vocabularyBehavior: ["the customer's own strength of words", "does not add 绝绝子 unless they were already that strong"],
    emotionBehavior: ["one peak", "does not label the emotion"],
    storyBehavior: ["the feeling is attached to a real dish, person, or room"],
    paragraphBehavior: ["the peak gets its own short space", "the rest is calmer"],
    endingBehavior: ["ends while the feeling is still there", "no 总结"],
    humanImperfections: ["may over-focus on one detail", "may leave other dishes out"],
    emojiBehavior: {
      frequency: "medium, clustered at the peak only",
      position: ["on the peak", "other paragraphs bare"],
      clustering: "allowed at the peak",
      standalone: "allowed once",
      noEmojiTendency: "high outside the peak",
    },
    antiAiSignals: ["even emotional temperature in every sentence", "a thesaurus of feelings"],
    do: ["keep the customer's intensity", "leave the rest plain"],
    dont: ["upgrade 喜欢 into 封神", "put a mood emoji on every sentence"],
  },
};

export type TitleHabits = {
  voice: string;
  rhythm: string;
  openings: string[];
  emotion: string;
  specificity: string;
  punctuation: string;
  emoji: string;
  ending: string;
  avoid: string[];
};

/** Title habits for the same styles. Tendencies, not fill-in templates. */
export const TITLE_HABITS: Record<HumanStyleId, TitleHabits> = {
  foodie: {
    voice: "a diner naming the bite, not a menu headline",
    rhythm: "short to medium; the three titles are not the same length",
    openings: ["the dish", "the texture or taste", "what they would order again"],
    emotion: "one title can be pleased; the others stay plainer",
    specificity: "a real dish or taste from this visit",
    punctuation: "usually no exclamation; do not end all three the same way",
    emoji: "one title in the batch carries the bite, at the start or the end, not glued to the dish name",
    ending: "stops on the food",
    avoid: ["restaurant name first on every title", "好好吃 as the whole title", "emoji after every noun"],
  },
  chatty: {
    voice: "a remark to a friend",
    rhythm: "one longer title, two shorter",
    openings: ["a mid-thought", "who it was for only if the note says so", "a plain observation"],
    emotion: "opinion, not a sales pitch",
    specificity: "one concrete detail, not every dish",
    punctuation: "rare question; not three questions",
    emoji: "one title in the batch, in the aside, not on every title",
    ending: "no slogan",
    avoid: ["不得不说", "终于找到", "product name plus exclamation"],
  },
  casual: {
    voice: "understated",
    rhythm: "mostly short",
    openings: ["what happened", "a mild verdict", "the dish without a setup"],
    emotion: "small; do not upgrade 还行",
    specificity: "one fact",
    punctuation: "no exclamation stack",
    emoji: "one light emoji on one title, start or end",
    ending: "stops",
    avoid: ["悬念", "必吃", "three equally polished lines"],
  },
  story: {
    voice: "one moment from the meal",
    rhythm: "mixed",
    openings: ["a moment in the visit", "after they sat down", "the dish that stayed with them"],
    emotion: "shown once",
    specificity: "the sequence only if the note has an order",
    punctuation: "plain",
    emoji: "one title, at a moment, not a marker on each title",
    ending: "no 总结",
    avoid: ["beginning-middle-end labels", "the same 这次来 opener on all three"],
  },
  short: {
    voice: "blunt",
    rhythm: "very short, but not three identical lengths",
    openings: ["the point", "the dish", "a plain like or dislike"],
    emotion: "one word is enough",
    specificity: "the strongest fact only",
    punctuation: "almost none",
    emoji: "one title, only at the point, start or end",
    ending: "no added closer",
    avoid: ["padding", "a hook formula"],
  },
  playful: {
    voice: "one light burst, then normal speech",
    rhythm: "one short burst title, two calmer",
    openings: ["a reaction", "the odd detail", "a plain line"],
    emotion: "only as strong as the note",
    specificity: "the joke must be a real detail",
    punctuation: "one title may be looser; not all three",
    emoji: "one title, on the burst, start or end, not after the noun; a second title only if it stays loose",
    ending: "no catchphrase",
    avoid: ["POV", "必冲", "the same joke shape every batch"],
  },
  travel: {
    voice: "the meal inside the day",
    rhythm: "medium",
    openings: ["where they already were, if the note says so", "the meal", "a practical note"],
    emotion: "low",
    specificity: "this branch only",
    punctuation: "plain",
    emoji: "one title, near the real place or the meal, not on every title",
    ending: "no itinerary pitch",
    avoid: ["another mall", "brochure adjectives", "逛完街 on every title"],
  },
  local: {
    voice: "someone who already eats here",
    rhythm: "short",
    openings: ["a habit", "the dish", "a direct opinion"],
    emotion: "familiar, not amazed",
    specificity: "what they ordered",
    punctuation: "plain",
    emoji: "one title, one natural spot, not a tourist sticker",
    ending: "no 必打卡",
    avoid: ["explaining Thai food", "隐藏宝藏", "终于发现"],
  },
  emotional: {
    voice: "one feeling tied to one real thing",
    rhythm: "the feeling title is short; the other two are quieter",
    openings: ["the feeling", "the person or dish it belongs to", "a plain line"],
    emotion: "one peak; do not put 绝绝子 on all three",
    specificity: "the thing that caused the feeling",
    punctuation: "the peak may have one mark; the others do not",
    emoji: "one title, on the real feeling, not on every title",
    ending: "no 总结",
    avoid: ["a thesaurus of feelings", "emoji on every title"],
  },
};

export function humanStyleById(id: string): HumanStyle | null {
  return (HUMAN_STYLE_IDS as readonly string[]).includes(id) ? HUMAN_STYLES[id as HumanStyleId] : null;
}
