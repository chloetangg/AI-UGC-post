import { CONTENT_LANGUAGE } from "@/lib/i18n";
import {
  formatLocationTimePlanRules,
  formatLocationTimeStaticRules,
  planLocationTime,
  officialLocationForBranch,
  resolveDiningBranch,
} from "@/lib/locations";
import { formatBrandSpellingRules, formatPlatformNicknameRule, type BrandSpelling } from "@/lib/brand-spelling";
import { getBranchBySurvey } from "@/lib/branches/registry";
import { formatHashtagFieldRules, isRequiredHashtag } from "@/lib/hashtags";
import { formatCaptionEmojiRules } from "@/lib/caption-emoji";
import { formatTitleFormatRules } from "@/lib/title-formats";
import { formatTitleKeywordRules } from "@/lib/title-keywords";
import { complianceGenerationRules } from "@/lib/compliance/prompt";
import { BAAN_YING_BRAND_CONTEXT } from "@/lib/brand/baan-ying-context";
import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { formatCoverHookRules, suggestCoverHookFamily } from "@/lib/cover/cover-hooks";
import { formatCoverStyleFitRules } from "@/lib/cover/style-fit";
import { formatCoverTitleInstance } from "@/lib/cover/cover-rules";
import {
  classifyCoverHookType,
  formatEvidencePriorityInstance,
  formatEvidencePriorityStaticRules,
  previousPrimaryExperienceId,
} from "@/lib/content-evidence";
import {
  formatGenerationVariationInstance,
  formatGenerationVariationStaticRules,
  planGenerationVariation,
  type GenerationMemory,
} from "@/lib/generation-variation";
import { formatPartySizeRules } from "@/lib/party-size";
import { allDishNameHints, chineseFullDishName } from "@/lib/cover/dish-names";
import {
  formatCaptionConsumerVoiceRules,
  formatCustomerOriginalVoiceRules,
  formatNaturalHumanWritingRules,
  formatSpokenNaturalnessRules,
  formatCustomerHookPriorityRules,
  formatCaptionShapeRules,
} from "@/lib/caption-voice";
import { buildEvidenceMap, formatContentLockInstance, formatContentLockStaticRules } from "@/lib/content-lock";
import { formatHumanStyleAntiAiCheck, formatHumanStyleInstance, formatHumanStyleStaticRules } from "@/lib/human-style/prompt";
import { selectHumanStyle } from "@/lib/human-style/select";
import { formatCustomerEvidencePlan } from "@/lib/customer-evidence";
import { formatNarrativeFlowInstance, formatNarrativeFlowStaticRules } from "@/lib/narrative-flow";
import { formatStrategyLibrary, formatStrategySelection } from "@/lib/content-strategy/format";
import type { ContentStrategyLibrary } from "@/lib/content-strategy/types";
import type { BrandContext, Campaign } from "@/types/campaign";
import type { GeneratePostInput } from "@/types/content";

export type GenerateRequestBody = GeneratePostInput & {
  brandName: string;
  productCategory: string;
  productDescription: string;
  brandContext?: BrandContext;
  contentStrategy?: ContentStrategyLibrary;
  analyticsSessionId?: string;
  brandId?: string;
  branchId?: string;
};

export function resolveContentStrategy(input?: { contentStrategy?: ContentStrategyLibrary }) {
  return input?.contentStrategy ?? BAAN_YING_CONTENT_STRATEGY;
}

function countCaptionSentences(caption: string) {
  const story = caption.replace(/\n*[📍⏰][\s\S]*$/, "").trim();
  if (!story) return 0;
  return (story.match(/[。！？!?]/g) ?? []).length || 1;
}

export const generatePostJsonSchema = {
  name: "xiaohongshu_ugc_post",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["titles", "caption", "hashtags", "mainTitle", "subTitle", "selectedPhotoIndex", "selectedPhotoIndexes", "photoSelectionReason", "selectedTemplateId", "suitableTemplateIds", "remainingPhotoOrder", "remainingOrderPattern", "selectedKspId", "selectedStorylineId", "selectedContentAngleId", "selectedSearchKeyword", "evidenceSource", "customerEvidenceUsed"],
    properties: {
      titles: {
        type: "array",
        description: "Exactly 3 Simplified Chinese post titles. Different hooks. No hashtags. Not the cover title.",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
      },
      caption: {
        type: "string",
        description: "Simplified Chinese story. 3–8 sentences, paragraphs separated by a blank line. No hashtags.",
      },
      hashtags: {
        type: "array",
        description: "Exactly 5: #BaanYing曼谷 plus 4 approved pool tags, shuffled.",
        minItems: 5,
        maxItems: 5,
        items: { type: "string" },
      },
      mainTitle: {
        type: "string",
        description: "Cover headline, 4–10 units, 1–2 pool keywords.",
      },
      subTitle: {
        type: "string",
        description: "Cover subtitle, 6–15 units, one extracted hook, not padded.",
      },
      selectedPhotoIndex: {
        type: "integer",
        description: "0-based strongest cover photo. 0 if only one photo.",
        minimum: 0,
        maximum: 4,
      },
      selectedPhotoIndexes: {
        type: "array",
        description: "[selectedPhotoIndex], or 4 indexes when a 2x2 grid style is chosen with 4+ photos.",
        minItems: 1,
        maxItems: 4,
        items: { type: "integer", minimum: 0, maximum: 4 },
      },
      photoSelectionReason: {
        type: "string",
        description: "One short Chinese sentence. No hashtags.",
      },
      selectedTemplateId: {
        type: "string",
        enum: [
          "top-stroke",
          "dual-line",
          "top-banner",
          "polaroid",
          "center-lower",
          "photo-only",
        ],
        description: "One id from suitableTemplateIds.",
      },
      suitableTemplateIds: {
        type: "array",
        description: "Template ids that fit the photos. Include selectedTemplateId. photo-only if none fit.",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "string",
          enum: [
            "top-stroke",
            "dual-line",
            "top-banner",
            "polaroid",
            "center-lower",
            "photo-only",
          ],
        },
      },
      remainingPhotoOrder: {
        type: "array",
        description: "Body photo indexes in story order.",
        minItems: 0,
        maxItems: 5,
        items: { type: "integer", minimum: 0, maximum: 4 },
      },
      remainingOrderPattern: {
        type: "string",
        enum: ["1", "2", "3", "4", "5", "6"],
        description: "Remaining-photo pattern 1–6.",
      },
      selectedKspId: {
        type: "string",
        description: "Internal KSP id. Never print it.",
      },
      selectedStorylineId: {
        type: "string",
        description: "Internal storyline id. Never print it.",
      },
      selectedContentAngleId: {
        type: "string",
        description: "Internal angle id. Never print it.",
      },
      selectedSearchKeyword: {
        type: "string",
        description: "Internal search keyword. Weave it in; do not label it.",
      },
      evidenceSource: {
        type: "object",
        description: "Internal only. Which pool each headline uses. Never print these labels in the post.",
        additionalProperties: false,
        required: ["title1", "title2", "title3", "coverMainTitle", "coverSubTitle"],
        properties: {
          title1: { type: "string", enum: ["customer", "other"] },
          title2: { type: "string", enum: ["customer", "other"] },
          title3: { type: "string", enum: ["customer", "other"] },
          coverMainTitle: { type: "string", enum: ["customer", "other"] },
          coverSubTitle: { type: "string", enum: ["customer", "other"] },
        },
      },
      customerEvidenceUsed: {
        type: "array",
        description: "Internal only. Customer points actually used. Empty when the note has no specific point.",
        maxItems: 6,
        items: { type: "string" },
      },
    },
  },
} as const;

export function buildGenerateRequest(
  campaign: Campaign,
  input: GeneratePostInput,
): GenerateRequestBody {
  return {
    ...input,
    branch: resolveDiningBranch(input.branch),
    brandName: campaign.brandName,
    productCategory: campaign.productCategory,
    productDescription: campaign.productDescription,
    brandContext: campaign.brandContext,
    contentStrategy: campaign.contentStrategy,
    contentLanguage: CONTENT_LANGUAGE,
  };
}

function list(values: string[]) {
  return values.join("、");
}

const DISH_NAME_HINTS = allDishNameHints();

const DISH_LEANING_ANGLES = new Set<string>([
  "CA-02",
  "CA-03",
  "CA-06",
  "dish-focused",
  "favorite-dish",
  "unexpected-favorite",
  "personal-food-reaction",
]);

function coverTitleHasDishName(title: string, extraNames: string[]) {
  const hay = title.toLowerCase();
  return [...DISH_NAME_HINTS, ...extraNames].some(
    (name) => name.trim() && hay.includes(name.trim().toLowerCase()),
  );
}

function formatBrandKnowledge(ctx?: BrandContext) {
  if (!ctx) return "No extra brand context. Write from the customer experience only.";
  return `BRAND, background only. Customer experience wins. At most one small detail if this meal supports it. Do not force 1999, Auntie Ying, Siam Square, family recipes, or branch count.
Tone: ${list(ctx.toneOfVoice)}
May use if evidenced: ${list(ctx.signature)}
Approved: ${list(ctx.approvedFacts)}
Avoid: ${list(ctx.avoid)}`;
}

function formatStyleReferences(ctx?: BrandContext) {
  if (!ctx?.referencePosts.length) {
    return "Write like a real Xiaohongshu diner: personal, conversational, specific.";
  }
  const posts = ctx.referencePosts
    .map((post) => `${post.id}: ${post.title} — ${post.characteristics[0] ?? ""}. Never copy: ${post.doNotCopy[0] ?? "exact phrasing"}.`)
    .join("\n");
  return `STYLE HABITS ONLY. Learn rhythm, paragraph shape, sentence length, and emoji habits. Never copy a sentence, title, opening, ending, or emoji sequence. Do not imitate one person.
${posts}`;
}

function formatMallMentionRules(branch: string) {
  const location = officialLocationForBranch(branch);
  const current = location
    ? `THIS BRANCH ONLY: ${location.officialLine}. Hours: ${location.hoursDisplay}. Do not name any other mall, floor, or opening hours.`
    : "Do not invent a mall, floor, or opening hours.";
  return `${formatLocationTimeStaticRules(branch)}
${current}`;
}

export function buildSystemPrompt(
  library: ContentStrategyLibrary = BAAN_YING_CONTENT_STRATEGY,
  brandContext: BrandContext = BAAN_YING_BRAND_CONTEXT,
  branch = "",
) {
  return `You write authentic Xiaohongshu UGC for one person who just ate and is posting for themselves.
Not: a brand ad, an official restaurant account, SEO copy, or an AI review template.
${formatPlatformNicknameRule()}

PRIORITY — when two instructions conflict, use this order:
1. SAFETY and hard facts
2. The customer's original experience and why they came
3. Content strategy, which only chooses what else from this visit is worth saying
4. THIS ROUND HUMAN STYLE, which only chooses how this person says it
5. Brand and branch facts that this story actually needs
6. Variation

The customer's note is the backbone. Knowing Baan Ying, the mall, 泰餐, a floor, hours, a KSP, or the dish list does not make those the topic.

LANGUAGE: Always Simplified Chinese (${CONTENT_LANGUAGE}). Never English copy. Dish names may stay original when natural. Do not translate this branch's official English mall name.

IDENTITY: Write as a real consumer. Do not use the customer's real name. How they sound comes from THIS ROUND HUMAN STYLE, not from a house tone.

CUSTOMER-FIRST: Their reason for coming, who they came with, who recommended it, and their own reaction drive the title, the caption, and the cover.
Do not replace that with the mall, the restaurant, 泰餐, or 曼谷. Do not explain the note word for word (这次是因为……所以……). Keep the meaning and say it naturally for this style.
A note such as 老婆上次来就说很好吃这次就带着一家人来了 is a return with family because she already liked it. It is not 在商场吃过的正宗泰餐, 逛完商场来吃, or 这次来到Baan Ying体验正宗泰式料理. Those lines are directions, not sentences to copy.
If they never mentioned the mall, Baan Ying, 泰餐, 商场, 曼谷, or a floor, do not put those in the opening to make the post feel complete. One later, natural mention is enough when THIS ROUND LOCATION PLAN asks for it.
Dishes are a pool. Use the 1–3 that fit this story. Do not praise every dish in the same frame, and do not glue two dishes into one sentence. Finish the thought, then start the next one.
Do not open with 这次在商场 / 最近来曼谷 / 逛完商场 / 来到Baan Ying / 今天来试试 / 曼谷又发现一家 / 这家泰餐真的 unless they wrote that scene.
Do not end with 下次还会再来 / 赶紧码住 / 大家一定要去 / 直接冲 / 值得推荐 / 下次来曼谷一定要吃 unless they said so. A post may just stop.
Cover mainTitle and subTitle follow the same personal story. They are not two ways to say 商场里吃泰餐. The subtitle adds a different fact.

SAFETY: Do not invent experiences, opinions, dishes, prices, promotions, ingredients, locations, awards, hours, events, spice, texture, cooking methods, celebrity visits, Michelin, rankings, party size, companions, or “best/No.1” claims.
Photos are evidence, not permission to hallucinate. Only mention visuals you can actually see AND that customer data can support.
${complianceGenerationRules()}

FOOD: Selected dishes are a pool, not a checklist. Even with 3–5 dishes, write the 1–3 that belong in this story. 1 dish → that dish.
Do not name dishes the user did not select or write. Do not give each dish 很好吃 in the same grammatical frame.
Pick only the content points this visit actually supports and write one coherent personal story. A short visit is still at least 3 sentences from those same facts. Do not invent a fact to look longer.
If they selected Fresh / Tender / Creamy / etc., weave those in. If they did not select spicy, do not invent spicy.

${formatStrategyLibrary(library)}

${formatBrandKnowledge(brandContext)}

${formatStyleReferences(brandContext)}

INTERNAL PROCESS (do not print KSP / Storyline / Content Angle / Search Keyword names in the post):
Read the customer note first. CONTENT EVIDENCE & LOCK, EVIDENCE PRIORITY, NARRATIVE FLOW, and CONTENT STRATEGY LAYER decide which true points to use. They do not replace the customer's reason with a KSP, a mall, or a cuisine label.
Select the most natural Content Angle from the lived evidence — not a default dish-recommendation or location angle.
Then write Caption → Titles → Cover and cross-check they share that same personal story. Return the chosen strategy ids in JSON.
Choose 4 random hashtags from the approved pool. Always include #BaanYing曼谷. Shuffle all 5. Do not invent tags. Do not hard-code hashtags by Storyline.
At most ONE small brand detail if it helps; otherwise omit brand history. KSP-03 is low-frequency.

${formatContentLockStaticRules()}

${formatEvidencePriorityStaticRules(branch)}

${formatNarrativeFlowStaticRules()}

TITLE MATERIAL — same response, no second call. Before mainTitle, subTitle, and the 3 titles, choose what in this visit is specific enough that a reader would stop. Use the note, the recommend reasons, enjoy-most, and the facts already selected. Prefer the most concrete point. Possible angles, not a checklist and not one sentence each: a dish detail worth remembering; a surprise the facts really support; a practical convenience in the trip, ordering, paying, or finding the place; a preference they stated; two supported points together; a concrete scene or a question a reader might have. If the input is only 很好吃 and has no detail, do not invent a contrast, a story, or a unique selling point. A personal way of saying the thin fact is allowed. A new fact is not. Do not make a plain line look clickable by bolting on 居然 / 没想到 / 一定要.

TITLES: Exactly 3 Simplified Chinese titles with different editorial angles AND different formats.
Follow the customer's reason first, then EVIDENCE PRIORITY title angles, TITLE SEARCH KEYWORDS, TITLE FORMAT DIVERSITY, and THIS ROUND HUMAN STYLE. A search keyword is not the title.
A title is one real point from this visit. It is not the caption's first sentence made shorter, and it does not invent a scene the caption cannot support.
Do not make all 3 titles a dish name plus its selling point. When the facts allow, the titles can take different kinds of angle: a personal reaction, one concrete dish detail, or a small scene. Those are options, not a fixed trio and not a call for suspense. Do not invent a price, a rank, a queue, a hidden menu, or a taste they did not give. Do not stretch one given point into an unstated texture, service gesture, or repeat-visit habit. 朋友介绍 is not 常去 or 每次来都很稳. Each title keeps the dish and the judgment that belong together.
A post title gives one concrete reason to read the caption: a specific experience, a stated preference, a real convenience, or a natural way in. Do not splice keywords, including 泰餐这家服务好舒服. A general line such as 店员服务真的很贴心 or 这家泰餐的服务真的不错 is only for a service point they actually gave; if they gave a concrete detail, keep that detail. Do not repeat the cover line. Do not turn every title into 菜名真的很好吃. Do not add a visit, a mood reversal, a discount, a queue, or a dish judgment they did not give, just to raise the click. Spoken is fine. A spliced phrase is not. Emoji stays on the existing title emoji rules. Do not put one on every title or pin it to the start or the end.
Before the JSON is finished, compare mainTitle, subTitle, and these 3 titles. If the cover and a post title would all say the same point, such as service, and another supported point exists, give one of them that other point. Do not get the difference by swapping 舒服 / 贴心 / 热情. If service is the only supported point, a post title may stay on service in different words. Do not invent a dish, a repeat visit, a price, a rank, a queue, a hidden menu, or a mall name to force them apart.
TITLE CHECK — still this same response, no second call. For mainTitle, subTitle, and each post title: does it say more than 这家店不错? Is there one reason to read on? Does it say the same thing as another of these lines? Is there a more specific supported angle? Does the interest come from a real fact, not an exaggerated word or an invented detail? If a line is only a flat restatement, switch to another supported angle. If it is already natural, specific, and worth a tap, leave it.
Unacceptable: 曼谷Baan Ying好好吃 / 真的好好吃 / 超好吃. Do not make the 3 titles the same sentence with different adjectives.
ZERO hashtags in titles.
If a title mentions 芒果 / 芒果糯米饭 / mango, use 🥭 not 🍋. 🍋 is lemon / 柠檬 / 青柠 only.
Title emojis follow THIS ROUND HUMAN STYLE. At least one of the 3 titles has one emoji from the caption list, except 🇹🇭. Usually one or two titles have one each. Do not glue it to the dish name, do not copy the caption placement, and do not put one on every title. A customer ban overrides that minimum. A leading 🇹🇭 is a separate prefix: about 1 in 5 titles, first character only, on at most one title in a batch of 3.
${formatTitleKeywordRules()}
${formatTitleFormatRules()}

CAPTION: one personal meal, told in one sitting. Follow the customer's reason, then THIS ROUND FOCUS and the blocks below. Do not only write 食物很好吃 when they gave more than one point. Do not open with the restaurant or the mall. Before the next dish, end the sentence. A reaction stays on the dish it belongs to.

${formatCaptionConsumerVoiceRules()}

${formatCustomerOriginalVoiceRules()}

${formatNaturalHumanWritingRules()}

${formatSpokenNaturalnessRules()}

${formatGenerationVariationStaticRules()}

${formatCustomerHookPriorityRules()}
Not a first visit: do not write a first-time discovery. Do not invent a repeat habit — 常去, 每次来, 每次都很稳, 又来了 — unless their own words already say it. 朋友介绍来吃 is one recommendation, not a history of visits.
Do not invent a headcount or companions from dish count, photos, or spend. A named reaction such as 小孩子很喜欢 stays that person's reaction, not 适合儿童. When nobody is named, use 这次来吃 / 这顿吃下来.
Do not write 第一次美食冒险 / 味蕾冒险. If a first visit at Baan Ying must be said, write 第一次来尝试Baan Ying.

${formatCaptionEmojiRules()}
${formatCaptionShapeRules()}
Do NOT put 🇹🇭 in the middle or end of a title, and do NOT start most titles with it. Decorative title emoji is separate from that rare leading flag.

${formatHumanStyleStaticRules()}

${formatMallMentionRules(branch)}

Titles and caption contain ZERO hashtags. Hashtags live only in JSON field "hashtags".
${formatHashtagFieldRules(getBranchBySurvey(branch)?.id)}

${formatCoverHookRules({ branch })}

COVER PHOTOS — selectedPhotoIndex is the ONE Cover Source for a normal cover.
Photos are attached in order: Photo 1 = 0, Photo 2 = 1, …
If photoCount is 1, selectedPhotoIndex must be 0.
If 2–5 photos, pick the strongest single cover photo among ALL attached photos. Do not default to upload order.
Prefer: clear food subject, large subject, complete composition.
If the photo has a text-safe zone, note it for overlay Styles. If the strongest photo has little safe zone, still pick it — then photo-only should be in suitableTemplateIds.
Do not edit, redraw, or generate photos. Only choose indexes.
photoSelectionReason: one short Chinese sentence.

COVER TEMPLATE — JSON fields "selectedTemplateId" + "suitableTemplateIds".
Must be one of: top-stroke, dual-line, top-banner, polaroid, center-lower, photo-only.
${formatCoverStyleFitRules()}
Do NOT invent a new template. Do NOT copy template IDs from the sample JSON. Do NOT list all 6 unless they all pass composition fit.
selectedTemplateId must be inside suitableTemplateIds. The website then picks the final Style from suitableTemplateIds (history avoidance + random). Never always output the same ID.
top-stroke and dual-line use a 4-photo grid when photoCount is 4 or more. Pick the best 4 photos in selectedPhotoIndexes. 1/2/3 photos with those styles is a normal single-photo cover, not a grid.
photo-only is a full-bleed photo with NO cover title or subtitle on the image. Still generate mainTitle and subTitle in JSON for the other styles.

REMAINING PHOTO ORDER — body photos are always ORIGINAL uploads, never the composed cover JPG/PNG.

IF the cover is a four-grid (photoCount >= 4 AND selectedTemplateId is top-stroke or dual-line):
Keep ALL original uploaded photos in the pool, including the 4 used on the grid. The grid only displays those photos; it does not consume them. Re-sort the FULL original set with the 6 patterns below. remainingPhotoOrder must contain every uploaded index. Do NOT copy selectedPhotoIndexes. Do NOT keep the 2x2 tile order. Do NOT drop Image 1–4 just because they appeared on the cover.

ELSE (any non-grid Style, including Style 1/2 with fewer than 4 photos):
Cover source = selectedPhotoIndex. Remove that original from the body pool. Re-sort only the leftover originals. If the cover used Image 3, remainingPhotoOrder must not include 3.

Classify the photos in THAT pool into: ALL FOOD, CUSTOMER-SELECTED/MENTIONED FOOD, FOOD, RESTAURANT ATMOSPHERE, CUSTOMER IN RESTAURANT, FOOD DETAILS.
Then choose ONE of these 6 patterns that the pool can actually support. Do not force a missing category. Do not duplicate a photo. Each photo at most once.
1: ALL FOOD → CUSTOMER-SELECTED FOOD → ATMOSPHERE
2: CUSTOMER-SELECTED FOOD → ALL FOOD → FOOD DETAILS
3: ATMOSPHERE → FOOD
4: CUSTOMER IN RESTAURANT → FOOD → FOOD DETAILS
5: FOOD → CUSTOMER IN RESTAURANT
6: FOOD (fallback)
remainingPhotoOrder = those original indexes in story order. If the pool is empty, return [].

REGENERATION: keep the same customer facts and write a new telling. Change opening, fact order, title angle, cover hook, hashtag pair, and location mode. Do not copy the previous cover. If 第一次 was already used and another legal hook exists, drop it.

OUTPUT: Return ONLY JSON matching the schema. No Markdown fences.
{"titles":["标题1","标题2","标题3"],"caption":"正文 only. Follow THIS ROUND LOCATION PLAN. No hashtags.","hashtags":["#曼谷美食","#BaanYing曼谷","#泰国菜","#曼谷打卡","#泰国"],"mainTitle":"封面主标题","subTitle":"另一个事实","selectedPhotoIndex":0,"selectedPhotoIndexes":[0],"photoSelectionReason":"...","selectedTemplateId":"<one of 10>","suitableTemplateIds":["<id>","<id>","<id>"],"remainingPhotoOrder":[1,2],"remainingOrderPattern":"5","selectedKspId":"KSP-01","selectedStorylineId":"ST-01","selectedContentAngleId":"CA-01","selectedSearchKeyword":"曼谷美食","evidenceSource":{"title1":"customer","title2":"other","title3":"customer","coverMainTitle":"customer","coverSubTitle":"customer"},"customerEvidenceUsed":["粉红奶很好喝"]}

The sample JSON is FORMAT ONLY. Do not copy its selectedTemplateId, suitableTemplateIds, or strategy ids.

VALIDATE: titles extract a hook and do not copy the note; if a mall name appears it is this branch's locked spelling and it is not the topic; caption is 3–8 sentences with blank lines between paragraphs; emoji never sits directly before Chinese punctuation; cover length and ranking rules hold; mainTitle and subTitle are not the same fact; 5 pool hashtags; no invented facts.
${formatHumanStyleAntiAiCheck()}`;
}

export function humanStyleForInput(input: GeneratePostInput) {
  const dishNames: string[] = input.recommendedDishes
    .filter((dish) => dish !== "Others")
    .map((dish) => chineseFullDishName(dish));
  if (input.recommendedDishOther.trim()) dishNames.push(input.recommendedDishOther.trim());
  return selectHumanStyle({
    diningNote: input.diningExperienceNote?.trim() ?? "",
    dishes: dishNames,
    enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
    customerType: input.customerType,
    visitFrequency: input.visitFrequency,
    contentAngleId: input.suggestedContentAngle?.trim() || "CA-01",
    storylineId: input.suggestedStorylineId?.trim() || "",
    variantIndex: input.variantIndex,
    previousCaption: input.previousCaption?.trim() || "",
    previousStyle: input.previousGenerationMemories?.at(-1)?.humanStyle,
  });
}

export function buildUserPrompt(input: GenerateRequestBody, spelling?: BrandSpelling) {
  const dishNames: string[] = input.recommendedDishes
    .filter((dish) => dish !== "Others")
    .map((dish) => chineseFullDishName(dish));
  if (input.recommendedDishOther.trim()) {
    dishNames.push(input.recommendedDishOther.trim());
  }
  const dishes = dishNames.join(", ");
  const reasonNames: string[] = [
    ...input.recommendTo,
    input.recommendToOther?.trim() ?? "",
  ].filter(Boolean);
  const reasons = reasonNames.join(", ");
  const diningNote = input.diningExperienceNote?.trim() ?? "";
  const origin = input.dinerOrigin?.trim();
  const diningBranch = resolveDiningBranch(input.branch);
  const previousTitle = input.previousTitle?.trim() || "";
  const previousCaption = input.previousCaption?.trim() || "";
  const previousCaptionSentences = countCaptionSentences(previousCaption);
  const previousAngle = input.previousContentAngle?.trim() || "";
  const previousKeywords = (input.previousTitleKeywords ?? []).map((item) => item.trim()).filter(Boolean);
  const otherPreviousTitles = (input.previousTitles ?? []).filter(
    (title) => title.trim() && title.trim() !== previousTitle,
  );
  const previousDynamicHashtags = (input.previousHashtags ?? []).filter(
    (tag) => !isRequiredHashtag(tag),
  );
  const library = resolveContentStrategy(input);
  const suggestedStrategy = {
    kspId: input.suggestedKspId?.trim() || "KSP-01",
    storylineId: input.suggestedStorylineId?.trim() || "ST-01",
    contentAngleId: input.suggestedContentAngle?.trim() || "CA-01",
    searchKeyword: input.suggestedSearchKeyword?.trim() || "曼谷美食",
  };
  const previousCoverTitle = input.previousCoverTitle?.trim() || "";
  const previousCoverHookType = classifyCoverHookType(previousCoverTitle);
  const previousPrimaryExperience = previousPrimaryExperienceId(
    {
      diningNote,
      dishes: dishNames,
      enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
      recommendTo: reasonNames,
      visitFrequency: input.visitFrequency,
      previousCoverTitle,
    },
    input.previousTitles ?? [],
  );
  const previousTitleAngle = classifyCoverHookType(previousTitle);
  const previousCoverHadDish = previousCoverTitle
    ? coverTitleHasDishName(previousCoverTitle, dishNames)
    : null;
  const previousCoverDishHint =
    previousCoverHadDish === null
      ? "none"
      : previousCoverHadDish
        ? "HAD a specific dish name — this round prefer NO dish name, unless a dish-leaning angle strongly needs one. Do not start a rigid on/off loop."
        : "had NO specific dish name — this round MAY use a real dish name if the angle supports it. Do not start a rigid on/off loop.";
  const dishAngleHint = DISH_LEANING_ANGLES.has(suggestedStrategy.contentAngleId)
    ? "Suggested angle is dish-leaning: a specific dish name is more welcome this round, but still optional."
    : "Suggested angle is experience/travel/group/atmosphere-leaning: prefer a mainTitle WITHOUT a specific dish name. Still lead with the customer's reason, not the mall.";
  const suggestedCoverHook = suggestCoverHookFamily({
    kspId: suggestedStrategy.kspId,
    storylineId: suggestedStrategy.storylineId,
    contentAngleId: suggestedStrategy.contentAngleId,
    hasDishes: dishNames.length > 0,
    customerType: input.customerType,
    previousCoverHadDish,
    variantIndex: input.variantIndex,
    branch: diningBranch,
    diningNote,
    previousCoverHookType,
  });
  const variationPlan = planGenerationVariation({
    context: {
      diningNote,
      dishes: dishNames,
      enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
      recommendTo: reasonNames,
      visitFrequency: input.visitFrequency,
      customerType: input.customerType,
      mealAmount: input.totalMealExpense,
      previousCoverTitle,
    },
    variantIndex: input.variantIndex,
    previousCaption,
    previousCoverTitle,
    previousTitles: input.previousTitles ?? [],
    previousMemories: input.previousGenerationMemories as GenerationMemory[] | undefined,
  });
  const lockContext = {
    diningNote,
    dishes: dishNames,
    enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
    recommendTo: reasonNames,
    visitFrequency: input.visitFrequency,
    customerType: input.customerType,
  };
  const evidenceMap = buildEvidenceMap(lockContext);
  const locationPlan = planLocationTime({
    branch: diningBranch,
    placement: input.requiredLocationPlacement,
    format: input.requiredLocationFormat,
    previousPlacement: input.previousLocationPlacement,
    previousFormat: input.previousLocationFormat,
    recentFormats: input.previousLocationFormats,
    inlineStyle: input.requiredInlineLocationStyle,
    inlineSlot: input.requiredInlineLocationSlot,
  });
  const humanStyle = humanStyleForInput(input);

  const previousBlock =
    previousTitle || previousCaption
      ? `PREVIOUS GENERATION (do not paraphrase or synonym-swap; write a new post with a different focus, structure, opening, fact order, and length band):
Previous KSP: ${input.previousKspId?.trim() || "none"}
Previous Storyline: ${input.previousStorylineId?.trim() || "none"}
Previous content angle: ${previousAngle || "Not provided"}
Previous search keyword: ${input.previousSearchKeyword?.trim() || "none"}
Previous cover hook type: ${previousCoverHookType}
Previous primary experience: ${previousPrimaryExperience || "none"}
Previous title angle: ${previousTitleAngle}
Title: ${previousTitle || "Not provided"}
${
  otherPreviousTitles.length > 0
    ? `Other previous title options:\n${otherPreviousTitles.map((title) => `- ${title}`).join("\n")}\n`
    : ""
}previousTitleKeywords: ${previousKeywords.length > 0 ? previousKeywords.join("、") : "none"}
Do NOT stuff 曼谷美食 / 曼谷泰餐 into titles.
Caption: ${previousCaption || "Not provided"}
Previous caption sentence count: ${previousCaptionSentences || "none"} — do not copy this length band if a shorter or longer telling still covers the facts.
Previous random pool hashtags: ${previousDynamicHashtags.length > 0 ? previousDynamicHashtags.join(" ") : "none"}
Pick 2 different pool tags. Do not repeat this pair when another pair exists.
Ignore any previous Location & Time or hashtag block. Do not invent new facts for variety. Do not pad to match the previous length.`
      : `PREVIOUS GENERATION: none. Still choose a fitting angle. Let caption length follow this visit.`;

  return `Create one Xiaohongshu post from this visit. The dining note is the story. Do not open from the brand or the mall.

CUSTOMER (keep their meaning; say it naturally for THIS ROUND HUMAN STYLE. Do not list the form. Do not explain the note with 因为/所以. Simple evidence → shorter caption. Richer evidence → naturally longer. Never pad.)
Dining note:
${diningNote || "Not provided"}
Tourist or local: ${input.customerType || "Not provided"}
Visit frequency: ${
    input.visitFrequency === "1st time"
      ? "Yes — first visit to Baan Ying only. Not a first Thai meal. Not the default hook if the note or dishes already give a stronger point."
      : input.visitFrequency === "Not first time"
        ? "No — not first visit"
        : "Not provided"
  }
Total meal expenses: ${
    input.mealExpenseRange?.trim() ||
    (typeof input.totalMealExpense === "number" && Number.isFinite(input.totalMealExpense)
      ? `${input.totalMealExpense.toFixed(0)} THB`
      : "Not provided")
  }
Origins: ${origin || "Not provided"}
Age range: ${input.dinerAgeRange?.trim() || "Not provided"}
Gender: ${input.dinerGender?.trim() || "Not provided"}
Enjoyed most: ${[...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean).join("、") || "Not provided"}
Recommended dishes (pool — choose 1–3 that fit the story, not every dish): ${dishes || "Not provided"}
Why they recommend: ${reasons || "Not provided"}
Follow NEGATIVE FEEDBACK. Do not paste the note, and do not upgrade it.
${formatCustomerEvidencePlan({
  note: diningNote,
  dishes: dishNames,
  enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
  recommendTo: reasonNames,
})}
${formatStrategySelection(library, suggestedStrategy, {
  customerType: input.customerType,
  visitFrequency: input.visitFrequency,
  enjoyMost: input.enjoyMost,
  recommendedDishes: input.recommendedDishes,
  recommendedDishOther: input.recommendedDishOther,
  recommendTo: input.recommendTo,
  diningExperienceNote: diningNote,
  branch: diningBranch,
  dinerOrigin: origin,
  dinerAgeRange: input.dinerAgeRange,
  dinerGender: input.dinerGender,
  photoCount: input.photoCount,
  variantIndex: input.variantIndex,
}, {
  previousKspId: input.previousKspId,
  previousStorylineId: input.previousStorylineId,
  previousContentAngleId: previousAngle,
  previousSearchKeyword: input.previousSearchKeyword,
})}
${formatHumanStyleInstance(humanStyle)}

BRAND — supporting only. Use a fact when the story needs it. Do not introduce the restaurant.
Brand: ${input.brandName}
Product: ${input.productName}
Category: ${input.productCategory}
Campaign content type: ${input.contentType}
Short description: ${input.productDescription}
${spelling ? `\n${formatBrandSpellingRules(spelling)}\n` : ""}
Branch (system context, not a survey answer): ${diningBranch}
Do not copy a spelling or floor that conflicts with the locked mall name.
${formatLocationTimePlanRules(locationPlan, diningBranch)}
Photo count (photos are attached in upload order as Photo 1 = index 0, Photo 2 = index 1, …): ${input.photoCount}
Previous cover templateId (do not reuse if another suitable existing template exists): ${input.previousCoverTemplateId?.trim() || "none"}
Previous mainTitle (do not copy; change STRUCTURE not just the last noun): ${previousCoverTitle || "none"}
Previous cover hook type: ${previousCoverHookType}
Previous primary experience: ${previousPrimaryExperience || "none"}
Previous title angle: ${previousTitleAngle}
${formatGenerationVariationInstance(variationPlan, input.previousGenerationMemories as GenerationMemory[] | undefined)}
${formatEvidencePriorityInstance(
  {
    branch: diningBranch,
    dishes: dishNames,
    previousCoverTitle,
    previousCoverHookType,
    previousPrimaryExperience,
    previousTitleAngle,
    variantIndex: input.variantIndex,
    kspId: suggestedStrategy.kspId,
    contentAngleId: suggestedStrategy.contentAngleId,
    diningNote,
    mealAmount: input.totalMealExpense,
    enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
    recommendTo: reasonNames,
    visitFrequency: input.visitFrequency,
    customerType: input.customerType,
  },
  input.previousTitles ?? [],
)}
${formatContentLockInstance(evidenceMap)}
${formatNarrativeFlowInstance(lockContext, evidenceMap)}
${formatPartySizeRules({
  diningNote,
  enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
})}
${formatCoverTitleInstance({
  branch: diningBranch,
  dishes: dishNames,
  previousCoverTitle,
  previousCoverHookType,
  previousPrimaryExperience,
  previousTitleAngle,
  variantIndex: input.variantIndex,
  kspId: suggestedStrategy.kspId,
  contentAngleId: suggestedStrategy.contentAngleId,
  diningNote,
  mealAmount: input.totalMealExpense,
  enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
  recommendTo: reasonNames,
  visitFrequency: input.visitFrequency,
  customerType: input.customerType,
})}
Previous mainTitle dish name: ${previousCoverDishHint}
${dishAngleHint}
Suggested cover hook family: ${suggestedCoverHook}. Use it if the customer evidence supports it; otherwise pick another family from the library. Do not invent social proof or dishes.
Photos are supporting evidence only. A clearly matching selected dish MAY appear in the mainTitle or subTitle, but do not put a dish name on every cover. Do not invent plating, crowd, celebrity, or interior details.
Pick selectedPhotoIndex from 0 to ${Math.max((input.photoCount || 1) - 1, 0)}. Diversity seed: ${input.variantIndex}.

${previousBlock}

Return JSON with titles[3], caption (story only), hashtags[5], mainTitle (the customer's angle, not a location headline), subTitle (a different fact, not a synonym of mainTitle), selectedPhotoIndex, selectedPhotoIndexes, photoSelectionReason, selectedTemplateId, suitableTemplateIds, remainingPhotoOrder, remainingOrderPattern, selectedKspId, selectedStorylineId, selectedContentAngleId, selectedSearchKeyword.`;
}
