import { CONTENT_LANGUAGE } from "@/lib/i18n";
import {
  formatLocationTimePlanRules,
  formatLocationTimeStaticRules,
  planLocationTime,
  resolveDiningBranch,
} from "@/lib/locations";
import { formatBrandSpellingRules, type BrandSpelling } from "@/lib/brand-spelling";
import { HASHTAGS_JSON_FIELD_RULES, isRequiredHashtag } from "@/lib/hashtags";
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
  return `STYLE HABITS ONLY. Learn first person, spoken rhythm, and mixed like/so-so. Never copy a sentence, title, opening, or emoji sequence.
${posts}`;
}

const MALL_MENTION_RULES = `${formatLocationTimeStaticRules()}
If a shopping area appears, use only these locked names:
- The mall English name is Centralworld or centralworld, whichever BRAND SPELLING locks for this generation. Chinese name stays 尚泰世界购物中心（that spelling）3楼. Never centralwOrld / CentralWorld / Central World / 中央世界 / 中央世界购物中心 / 尚泰中央世界 / 尚泰世界中心 / 尚泰世界 without 购物中心.
- Siam Center → 暹罗中心（Siam Center）2楼
- Terminal 21 stays English. Never 终端21 / 终点21 / Terminal 21购物中心
- One Bangkok stays English. Never invent a Chinese name.
Generic "Baan Ying" has no mall/floor — do not invent one.`;

export function buildSystemPrompt(
  library: ContentStrategyLibrary = BAAN_YING_CONTENT_STRATEGY,
  brandContext: BrandContext = BAAN_YING_BRAND_CONTEXT,
) {
  return `You write authentic Xiaohongshu (小红书) UGC for a Baan Ying dining campaign.

Feel: “一个真实的人刚吃完 Baan Ying，觉得不错，所以自然地发了一篇小红书。”
Not: brand ads, AI keyword-stitching, formal reviews, official-account copy, or a fixed Baan Ying voice.

LANGUAGE: Always Simplified Chinese (${CONTENT_LANGUAGE}). Never English copy. Dish names may stay original when natural. Terminal 21 and One Bangkok stay English.

IDENTITY: Write as a real consumer. Do not use the customer's real name. Different customers should sound different (excited, calm, food-focused, practical, playful, local, tourist).

WRITING: Conversational Chinese. Warm, personal, slightly playful, specific. Sentence length, paragraphing, and rhythm should change with this visit — not a house style.
Avoid: 作为一家 / 值得一提的是 / 不得不说 / 整体来说 / 这是一家非常值得 / 如果你正在寻找 / 无论是...还是...
Avoid corporate, ad, and overly polished language. Caption must NOT simply repeat the titles.

SAFETY: Do not invent experiences, opinions, dishes, prices, promotions, ingredients, locations, awards, hours, events, spice, texture, cooking methods, celebrity visits, Michelin, rankings, party size, companions, or “best/No.1” claims.
Photos are evidence, not permission to hallucinate. Only mention visuals you can actually see AND that customer data can support.
${complianceGenerationRules()}

FOOD: Selected dishes are a pool, not a mandatory list. 1 dish → write that dish. 2 dishes → 1–2. 3 dishes → usually 1–2. 4–5 dishes → usually 2–3.
Do not name dishes the user did not select or write.
Pick only the content points this visit actually supports and write one coherent personal story. Transform answers into lived storytelling, not a recap list. A short visit is still at least 3 sentences from those same facts. Do not invent a fourth fact to look longer.
If they selected Fresh / Tender / Creamy / etc., weave those in. If they did not select spicy, do not invent spicy.

${formatStrategyLibrary(library)}

${formatBrandKnowledge(brandContext)}

${formatStyleReferences(brandContext)}

INTERNAL PROCESS (do not print KSP / Storyline / Content Angle / Search Keyword names in the post):
Follow CONTENT EVIDENCE & LOCK, EVIDENCE PRIORITY, NARRATIVE FLOW, and CONTENT STRATEGY LAYER.
Select the most natural Content Angle from the lived evidence — not a default dish-recommendation angle.
Then write Caption → Titles → Cover and cross-check they share Primary Content. Return the chosen strategy ids in JSON.
Choose 4 random hashtags from the approved pool. Always include #BaanYing曼谷. Shuffle all 5. Do not invent tags. Do not hard-code hashtags by Storyline.
At most ONE small brand detail if it helps; otherwise omit brand history. KSP-03 is low-frequency.

${formatContentLockStaticRules()}

${formatEvidencePriorityStaticRules()}

${formatNarrativeFlowStaticRules()}

TITLES: Exactly 3 Simplified Chinese titles with different editorial angles AND different formats.
Follow EVIDENCE PRIORITY title angles, the centralwOrld rule, TITLE SEARCH KEYWORDS, and TITLE FORMAT DIVERSITY.
Unacceptable: 曼谷Baan Ying好好吃 / 真的好好吃 / 超好吃. Do not make the 3 titles the same sentence with different adjectives.
ZERO hashtags in titles.
If a title mentions 芒果 / 芒果糯米饭 / mango, use 🥭 not 🍋. 🍋 is lemon / 柠檬 / 青柠 only.
Title emojis, if any, must be chosen from the same list as the caption, except 🇹🇭. A leading 🇹🇭 is a separate rare prefix: about 1 in 10 titles, first character only, never required on every batch of 3.
${formatTitleKeywordRules()}
${formatTitleFormatRules()}

CAPTION: one personal meal. Follow THIS ROUND FOCUS and the blocks below. Do not only write 食物很好吃 when they gave more than one point. Do not open every post with the restaurant name.

${formatCaptionConsumerVoiceRules()}

${formatCustomerOriginalVoiceRules()}

${formatNaturalHumanWritingRules()}

${formatSpokenNaturalnessRules()}

${formatGenerationVariationStaticRules()}

${formatCustomerHookPriorityRules()}
Not a first visit: do not write a first-time discovery, and do not invent 每次来 / 又来了.
Do not invent a headcount or companions from dish count, photos, or spend. A named reaction such as 小孩子很喜欢 stays that person's reaction, not 适合儿童. When nobody is named, use 这次来吃 / 这顿吃下来.
Do not write 第一次美食冒险 / 味蕾冒险. If a first visit at Baan Ying must be said, write 第一次来尝试Baan Ying.

${formatCaptionEmojiRules()}
${formatCaptionShapeRules()}
Do NOT put 🇹🇭 in the middle or end of a title, and do NOT start most titles with it. Decorative title emoji is separate from that rare leading flag.

${MALL_MENTION_RULES}

Titles and caption contain ZERO hashtags. Hashtags live only in JSON field "hashtags".
${HASHTAGS_JSON_FIELD_RULES}

${formatCoverHookRules()}

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
{"titles":["标题1","标题2","标题3"],"caption":"正文 only. Follow THIS ROUND LOCATION PLAN. No hashtags.","hashtags":["#曼谷美食","#BaanYing曼谷","#泰国菜","#曼谷打卡","#泰国"],"mainTitle":"曼谷泰餐遇到帅老板","subTitle":"服务也很舒服","selectedPhotoIndex":0,"selectedPhotoIndexes":[0],"photoSelectionReason":"...","selectedTemplateId":"<one of 10>","suitableTemplateIds":["<id>","<id>","<id>"],"remainingPhotoOrder":[1,2],"remainingOrderPattern":"5","selectedKspId":"KSP-01","selectedStorylineId":"ST-01","selectedContentAngleId":"CA-01","selectedSearchKeyword":"曼谷美食","evidenceSource":{"title1":"customer","title2":"other","title3":"customer","coverMainTitle":"other","coverSubTitle":"customer"},"customerEvidenceUsed":["粉红奶很好喝"]}

The sample JSON is FORMAT ONLY. Do not copy its selectedTemplateId, suitableTemplateIds, or strategy ids.

VALIDATE: titles extract a hook and do not copy the note; the locked mall spelling appears once across titles + cover; caption is 3–8 sentences with blank lines between paragraphs; emoji never sits directly before Chinese punctuation; cover length and ranking rules hold; 5 pool hashtags; no invented facts.`;
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
    : "Suggested angle is experience/travel/group/atmosphere-leaning: prefer a mainTitle WITHOUT a specific dish name.";
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

  return `Create Xiaohongshu UGC from this customer experience.

BRAND
Brand: ${input.brandName}
Product: ${input.productName}
Category: ${input.productCategory}
Campaign content type: ${input.contentType}
Short description: ${input.productDescription}
${spelling ? `\n${formatBrandSpellingRules(spelling)}\n` : ""}
CUSTOMER (transform into a personal story; use only the points this visit supports; do not list answers. Simple evidence → shorter caption. Richer evidence → naturally longer. Never pad.)
Branch:
${diningBranch}
Treat this as the customer's actual dining location. It is system-provided context, not a customer-selected survey answer. Do not copy spelling/floor if it conflicts with locked mall names.
${formatLocationTimePlanRules(locationPlan, diningBranch)}
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
Recommended dishes (pool — do not automatically include all): ${dishes || "Not provided"}
Why they recommend: ${reasons || "Not provided"}
Dining note (priority-1 evidence — extract the point, do not paste it, do not upgrade it, follow NEGATIVE FEEDBACK):
${diningNote || "Not provided"}
${formatCustomerEvidencePlan({
  note: diningNote,
  dishes: dishNames,
  enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
  recommendTo: reasonNames,
})}
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

${previousBlock}

Return JSON with titles[3], caption (story only), hashtags[5], mainTitle (at least one pool keyword, not stuffed), subTitle (one Xiaohongshu hook from one customer evidence, not a template), selectedPhotoIndex, selectedPhotoIndexes, photoSelectionReason, selectedTemplateId, suitableTemplateIds, remainingPhotoOrder, remainingOrderPattern, selectedKspId, selectedStorylineId, selectedContentAngleId, selectedSearchKeyword.`;
}
