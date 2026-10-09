import { HUMAN_STYLE_IDS, HUMAN_STYLES, type HumanStyleId } from "@/lib/human-style/library";

/**
 * Topic signals describe what this visit contains.
 * They do not name the writer's personality.
 */
export type ContentSignals = {
  foodSpecificity: number;
  foodiePersonality: number;
  atmosphereEvidence: number;
  personalStoryEvidence: number;
  travelContext: number;
  localContext: number;
  emotionIntensity: number;
  conversationalEvidence: number;
  brevitySignal: number;
  playfulnessSignal: number;
};

export type EmojiMode = "none" | "light" | "natural" | "playful";

export type StyleVariant = {
  opening: string;
  rhythm: string;
  detailLevel: string;
  emotionalIntensity: string;
  paragraphShape: string;
  ending: string;
  emojiMode: EmojiMode;
};

export type HumanStyleSelection = {
  primaryStyle: HumanStyleId;
  secondaryStyle?: HumanStyleId;
  /** 0.5–0.8. How strongly this person's habits show. */
  intensity: number;
  /** 0–1. Shifts rhythm inside the same style. */
  variation: number;
  signals: ContentSignals;
  variant: StyleVariant;
  emojiMode: EmojiMode;
};

export type HumanStyleContext = {
  diningNote?: string;
  dishes?: string[];
  enjoyMost?: string[];
  customerType?: string;
  visitFrequency?: string;
  contentAngleId?: string;
  storylineId?: string;
  variantIndex?: number;
  previousCaption?: string;
  previousStyle?: string;
};

const SENSORY = /口感|甜度|Q弹|奶香|层次|酸辣|软烂|香气|锅气|粘度|糯|入味|鲜/;
const CHAT = /我们|觉得|然后|其实|就是|不过|结果/;
const TRAVEL = /逛|商场|飞机|旅行|游客|下车|逛街/;
const STORY = /然后|后来|先|接着|逛完|到了|本来|结果/;
const PLAY = /哈哈|绝了|停不下来|笑死|真的会/;
const FEEL = /想再|太好|爱了|开心|漂亮|帅|感动|放松|舒服|喜欢/;

const VARIANT_OPENINGS: Record<HumanStyleId, string[]> = {
  foodie: [
    "one texture or taste, then stop",
    "the dish they would order again, other dishes only as context",
    "how one bite felt",
    "two named dishes compared inside one sentence",
    "the drink or the last bite, not every plate",
  ],
  chatty: [
    "start mid-thought, as if already talking",
    "one aside, then the dish that caused it",
    "a small turn such as 其实 or 结果, only if it stays natural",
    "talk through the meal without a plate-by-plate list",
    "one opinion first, food second",
  ],
  casual: [
    "start on the experience, no setup",
    "start from one small scene the note actually has",
    "start from one small discovery",
    "start with a mild feeling",
    "start from one dish or drink, then stop listing",
  ],
  story: [
    "a moment before the food, only if the note has an order",
    "one discovery during the meal",
    "the dish that stayed, after a short setup",
    "how the meal ended up feeling",
    "one scene, then one bite",
  ],
  short: [
    "the single strongest point",
    "one dish and stop",
    "one feeling and stop",
    "the drink or the room, not both at length",
    "a plain verdict",
  ],
  playful: [
    "one light reaction, then ordinary speech",
    "the odd real detail",
    "a plain line, with the joke only if the note is already playful",
    "one burst, then a calm second paragraph",
    "the drink or the bite, not a slogan",
  ],
  travel: [
    "where they already were, only if the note says so",
    "the meal inside the day",
    "one practical note, then one dish",
    "the mall only as the way they arrived",
    "the food, with the trip as context not the subject",
  ],
  local: [
    "a habit, not a discovery",
    "the dish, said plainly",
    "a direct opinion",
    "what they would order again, once",
    "the room or the meal, not a guide",
  ],
  emotional: [
    "the feeling first, tied to one real thing",
    "the dish or person the feeling belongs to",
    "a plain line, then one peak",
    "how they felt at the end",
    "one quiet reaction",
  ],
};

const VARIANT_RHYTHM = [
  "mix one short sentence with one longer one",
  "keep most sentences medium, one of them shorter",
  "let the first sentence be the longest",
  "two short sentences, then one that carries the detail",
  "uneven: do not make every sentence the same length",
];

const VARIANT_DETAIL = [
  "keep 2 points, leave the rest out",
  "keep 3 points, do not cover the whole form",
  "one dish gets the detail, the others are named once together",
  "the feeling gets one sentence, the food gets one sentence",
  "skip any point that does not change the story",
];

const VARIANT_EMOTION = [
  "mild, do not upgrade the note",
  "one sentence may be warmer, the rest stay flat",
  "almost no emotion words",
  "the peak is one clause, not the whole caption",
  "match the note, including a mild 还想再来",
];

const VARIANT_PARAGRAPH = [
  "2 sentences, then 2 or 3",
  "3 sentences, then a shorter paragraph",
  "one paragraph of 3, then one of 2",
  "short opening paragraph, then the meal",
  "the meal together, the feeling in the next paragraph",
];

const VARIANT_ENDING = [
  "stop on the last real detail",
  "stop on the feeling, with no slogan",
  "stop on the drink or the dish, once",
  "no summary sentence",
  "a practical leftover, not a recommendation",
];

export function readContentSignals(input: HumanStyleContext = {}): ContentSignals {
  const note = input.diningNote?.trim() ?? "";
  const enjoy = (input.enjoyMost ?? []).join(" ");
  const dishes = (input.dishes ?? []).filter((dish) => dish.trim());
  const foodHits = (note.match(/好吃|好喝|味道|虾|蟹|咖喱|冬阴功|粉红奶|糯米|炒饭|泰餐/g) ?? []).length;
  return {
    foodSpecificity: Math.min(4, dishes.length + (foodHits > 0 ? 1 : 0)),
    foodiePersonality: SENSORY.test(note) || SENSORY.test(enjoy) ? 1 : 0,
    atmosphereEvidence: /环境|氛围|舒服|放松|坐着|空间/.test(`${note}${enjoy}`) ? 1 : 0,
    personalStoryEvidence: STORY.test(note) || input.visitFrequency === "1st time" ? 1 : 0,
    travelContext: (TRAVEL.test(note) ? 2 : 0) + (input.customerType === "Tourist" ? 1 : 0),
    localContext: input.customerType === "Local" || /本地|附近|常来/.test(note) ? 1 : 0,
    emotionIntensity: (FEEL.test(note) ? 1 : 0) + (/服务|环境|老板|放松|舒服/.test(enjoy) ? 1 : 0),
    conversationalEvidence: CHAT.test(note) || note.length > 48 ? 1 : 0,
    brevitySignal: note.length > 0 && note.length <= 14 ? 2 : note.length > 0 && note.length <= 28 ? 1 : 0,
    playfulnessSignal: PLAY.test(note) ? 1 : 0,
  };
}

function angleNudge(angle: string, weights: Record<HumanStyleId, number>) {
  if (angle === "CA-04" || angle === "CA-09") {
    weights.travel += 1;
    weights.story += 1;
  } else if (angle === "CA-05") {
    weights.local += 1;
    weights.casual += 1;
  } else if (angle === "CA-11") weights.casual += 1;
  else if (angle === "CA-12") weights.story += 1;
  else if (angle === "CA-07" || angle === "CA-08") weights.chatty += 1;
}

/** Personality weights. A plate of food does not add points to Foodie. */
export function personalityWeights(input: HumanStyleContext = {}): Record<HumanStyleId, number> {
  const signals = readContentSignals(input);
  const weights = Object.fromEntries(HUMAN_STYLE_IDS.map((id) => [id, 8])) as Record<HumanStyleId, number>;
  if (signals.brevitySignal >= 2) {
    weights.short += 4;
    weights.casual += 1;
  } else if (signals.brevitySignal === 1) weights.casual += 2;
  if (signals.conversationalEvidence >= 1) weights.chatty += 4;
  if (signals.playfulnessSignal >= 1) weights.playful += 4;
  if (signals.emotionIntensity >= 2) weights.emotional += 3;
  else if (signals.emotionIntensity === 1) weights.emotional += 1;
  if (signals.travelContext >= 2) weights.travel += 3;
  else if (signals.travelContext === 1) weights.travel += 1;
  if (signals.localContext >= 1) weights.local += 3;
  if (signals.personalStoryEvidence >= 1) weights.story += 2;
  if (signals.atmosphereEvidence >= 1) {
    weights.casual += 1;
    weights.emotional += 1;
  }
  if (signals.foodiePersonality >= 1) weights.foodie += 2;
  angleNudge(input.contentAngleId ?? "", weights);
  return weights;
}

function pickWeighted(weights: Record<HumanStyleId, number>, seed: number, avoid?: HumanStyleId) {
  const ids = HUMAN_STYLE_IDS.filter((id) => id !== avoid && weights[id] > 0);
  const total = ids.reduce((sum, id) => sum + weights[id], 0);
  let cursor = Math.abs(seed) % Math.max(total, 1);
  for (const id of ids) {
    cursor -= weights[id];
    if (cursor < 0) return id;
  }
  return ids[0] ?? "casual";
}

function isStyleId(value: string | undefined): value is HumanStyleId {
  return Boolean(value && (HUMAN_STYLE_IDS as readonly string[]).includes(value));
}

export function emojiModeFor(style: HumanStyleId, variantIndex: number): EmojiMode {
  const step = Math.max(0, variantIndex) % 5;
  const lively = style === "playful" || style === "emotional" || style === "foodie";
  const quiet = style === "short" || style === "local" || style === "casual";
  if (quiet) return step === 1 || step === 4 ? "light" : "none";
  if (lively) {
    if (step === 0) return "none";
    if (step === 2) return "natural";
    if (step === 3) return "playful";
    return "light";
  }
  if (step === 0 || step === 2) return "none";
  if (step === 3) return "natural";
  return "light";
}

function variantFor(style: HumanStyleId, variantIndex: number): StyleVariant {
  const step = Math.max(0, variantIndex);
  return {
    opening: VARIANT_OPENINGS[style][step % VARIANT_OPENINGS[style].length] ?? VARIANT_OPENINGS.casual[0],
    rhythm: VARIANT_RHYTHM[step % VARIANT_RHYTHM.length] ?? VARIANT_RHYTHM[0],
    detailLevel: VARIANT_DETAIL[(step + 1) % VARIANT_DETAIL.length] ?? VARIANT_DETAIL[0],
    emotionalIntensity: VARIANT_EMOTION[(step + 2) % VARIANT_EMOTION.length] ?? VARIANT_EMOTION[0],
    paragraphShape: VARIANT_PARAGRAPH[step % VARIANT_PARAGRAPH.length] ?? VARIANT_PARAGRAPH[0],
    ending: VARIANT_ENDING[(step + 3) % VARIANT_ENDING.length] ?? VARIANT_ENDING[0],
    emojiMode: emojiModeFor(style, step),
  };
}

/**
 * Content signals decide what is eligible to mention.
 * Personality weights decide how this person talks.
 * variantIndex changes the telling. It does not cycle the 9 styles.
 * A previous style usually stays. Every third regenerate may switch.
 */
export function selectHumanStyle(input: HumanStyleContext = {}): HumanStyleSelection {
  const signals = readContentSignals(input);
  const weights = personalityWeights(input);
  const variant = Math.max(0, input.variantIndex ?? 0);
  const previous = isStyleId(input.previousStyle) ? input.previousStyle : undefined;
  const stay = Boolean(previous) && variant % 3 !== 0;
  const primaryStyle = stay && previous ? previous : pickWeighted(weights, variant * 29 + 11, previous);
  const variantPlan = variantFor(primaryStyle, variant);
  return {
    primaryStyle,
    intensity: 0.55 + (variant % 3) * 0.1,
    variation: ((variant * 17) % 100) / 100,
    signals,
    variant: variantPlan,
    emojiMode: variantPlan.emojiMode,
  };
}

export function humanStyleLabel(id: HumanStyleId) {
  return HUMAN_STYLES[id].name;
}
