import { CONTENT_LANGUAGE } from "@/lib/i18n";
import { resolveDiningBranch } from "@/lib/locations";
import { HASHTAGS_JSON_FIELD_RULES, REQUIRED_HASHTAGS } from "@/lib/hashtags";
import { formatTitleFormatRules } from "@/lib/title-formats";
import { formatTitleKeywordRules } from "@/lib/title-keywords";
import { complianceGenerationRules } from "@/lib/compliance/prompt";
import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { formatCoverHookRules, suggestCoverHookFamily } from "@/lib/cover/cover-hooks";
import { formatCoverTitleRules } from "@/lib/cover/cover-rules";
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
};

export function resolveContentStrategy(input?: { contentStrategy?: ContentStrategyLibrary }) {
  return input?.contentStrategy ?? BAAN_YING_CONTENT_STRATEGY;
}

export const generatePostJsonSchema = {
  name: "xiaohongshu_ugc_post",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["titles", "caption", "hashtags", "mainTitle", "subTitle", "selectedPhotoIndex", "selectedPhotoIndexes", "photoSelectionReason", "selectedTemplateId", "suitableTemplateIds", "remainingPhotoOrder", "remainingOrderPattern", "selectedKspId", "selectedStorylineId", "selectedContentAngleId", "selectedSearchKeyword"],
    properties: {
      titles: {
        type: "array",
        description:
          "Exactly 3 Simplified Chinese Xiaohongshu POST titles with different angles and formats. No hashtags. These are NOT the cover title.",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
      },
      caption: {
        type: "string",
        description:
          "One Simplified Chinese story body with 2–6 natural emojis. No hashtags. No Location & Time block.",
      },
      hashtags: {
        type: "array",
        description:
          "Exactly 5 hashtags in order: #baanying曼谷, #曼谷必吃, #centralworld泰餐推荐, then 2 tags from the approved pool only.",
        minItems: 5,
        maxItems: 5,
        items: { type: "string" },
      },
      mainTitle: {
        type: "string",
        description:
          "Independent Xiaohongshu COVER mainTitle. HARD 4–7 Chinese-character-equivalent units. Never 3. Never 8+. Together with subTitle, use EXACTLY 2 keywords from 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃. Communicate KSP. No emoji. Never shorten titles[]. Never truncate. Do not pad with filler.",
      },
      subTitle: {
        type: "string",
        description:
          "Independent COVER subTitle under mainTitle. HARD 4–9 units. Different role from mainTitle: add KSP/context, not a keyword repeat. Together with mainTitle, exactly 2 pool keywords. No emoji. Never empty. Never truncate.",
      },
      selectedPhotoIndex: {
        type: "integer",
        description:
          "0-based index of the strongest cover photo. 0 = Photo 1. Must be in range. If only 1 photo, must be 0. Must match mainTitle.",
        minimum: 0,
        maximum: 4,
      },
      selectedPhotoIndexes: {
        type: "array",
        description:
          "For a normal cover, return [selectedPhotoIndex] only. If photoCount is 4 or more AND selectedTemplateId is top-stroke, badge-stack, or dual-line, return exactly 4 unique indexes for the 2x2 grid (best photos first). selectedPhotoIndexes[0] must equal selectedPhotoIndex.",
        minItems: 1,
        maxItems: 4,
        items: { type: "integer", minimum: 0, maximum: 4 },
      },
      photoSelectionReason: {
        type: "string",
        description:
          "One short Simplified Chinese sentence explaining why this photo is the best cover. No hashtags.",
      },
      selectedTemplateId: {
        type: "string",
        enum: [
          "top-stroke",
          "bottom-bar",
          "bottom-card",
          "top-banner",
          "left-spine",
          "polaroid",
          "center-lower",
          "badge-stack",
          "split-band",
          "dual-line",
        ],
        description:
          "Exactly one existing cover templateId that best fits these photos. Must be visually suitable. Do NOT default to bottom-card. Do not copy the sample JSON template IDs. Prefer a different template than the previous generation when another suitable option exists.",
      },
      suitableTemplateIds: {
        type: "array",
        description:
          "1–10 existing templateIds that genuinely fit these photos. Must include selectedTemplateId. Do not list unsuitable templates.",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "string",
          enum: [
            "top-stroke",
            "bottom-bar",
            "bottom-card",
            "top-banner",
            "left-spine",
            "polaroid",
            "center-lower",
            "badge-stack",
            "split-band",
            "dual-line",
          ],
        },
      },
      remainingPhotoOrder: {
        type: "array",
        description:
          "0-based indexes for the body carousel, unique. For a normal cover, exclude selectedPhotoIndex. Empty array if only 1 photo. If photoCount is 4 or more AND selectedTemplateId is top-stroke, badge-stack, or dual-line, include ALL uploaded indexes and apply the 6 remaining-photo patterns — do not exclude the 4-grid cover photos, do not force upload order, and do not append cover photos after the others.",
        minItems: 0,
        maxItems: 5,
        items: { type: "integer", minimum: 0, maximum: 4 },
      },
      remainingOrderPattern: {
        type: "string",
        enum: ["1", "2", "3", "4", "5", "6"],
        description:
          "Which of the 6 approved remaining-photo order patterns was used. Use 6 if only food remains or only 1 remaining photo.",
      },
      selectedKspId: {
        type: "string",
        description: "Internal KSP id chosen for this post, e.g. KSP-01. Never print this in the consumer post.",
      },
      selectedStorylineId: {
        type: "string",
        description: "Internal Storyline id chosen for this post, e.g. ST-01. Never print this in the consumer post.",
      },
      selectedContentAngleId: {
        type: "string",
        description: "Internal Content Angle id chosen for this post, e.g. CA-01. Never print this in the consumer post.",
      },
      selectedSearchKeyword: {
        type: "string",
        description: "Internal search keyword chosen for titles, e.g. 曼谷美食. Integrate naturally; do not print as a label.",
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

const DISH_NAME_HINTS = [
  "黄咖喱蟹肉",
  "咖喱蟹",
  "curry crab",
  "冬阴功虾汤",
  "冬阴功",
  "tom yum",
  "泰式酸甜蒸鱼",
  "蒸鱼",
  "蒜蓉炒虾",
  "炒虾",
  "芒果糯米饭",
  "糯米饭",
  "mango sticky",
];

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
  return `Background only (do not dump into every post): ${ctx.story}

Personality (show, do not list): ${list(ctx.personality)}
Tone: ${list(ctx.toneOfVoice)}
Signature concepts (use only if THIS meal supports them): ${list(ctx.signature)}
Approved facts (use sparingly if they strengthen THIS story): ${list(ctx.approvedFacts)}
Avoid: ${list(ctx.avoid)}

Customer experience > brand information. At most ONE small brand detail if it naturally helps. Otherwise omit it.
Do NOT repeatedly mention 1999, Auntie Ying, Siam Square, family recipes, or “multiple branches”.
GOOD: 第一次来曼谷的时候刚好逛到这里，后来才发现 Baan Ying 原来从1999年就开始做泰国家常菜了。
BAD: Baan Ying成立于1999年，是一家拥有多年历史、提供正宗泰国舒适家常菜的餐厅，目前在曼谷拥有多个分店。`;
}

function formatStyleReferences(ctx?: BrandContext) {
  if (!ctx?.referencePosts.length) {
    return "Write like a real Xiaohongshu diner: personal, conversational, specific.";
  }
  const posts = ctx.referencePosts
    .map((post) => `${post.id}: ${post.title} — ${post.characteristics[0] ?? ""}. Never copy: ${post.doNotCopy[0] ?? "exact phrasing"}.`)
    .join("\n");
  return `STYLE REFERENCES ONLY. Learn voices; never copy sentences, titles, openings, structures, or emoji sequences.
Distribute across concise, emotional, dish-driven, diary, practical, travel, local, discovery, group, and repeat-visit voices.

${posts}

Learn: start from a personal moment, not always the restaurant name; 我去吃了什么 → 我有什么感受 → 为什么推荐; use only customer-supported food qualities; mix feeling + food + useful info; conversational Chinese with mixed short/medium sentences.`;
}

const MALL_MENTION_RULES = `Do NOT write Location & Time, 📍/⏰ blocks, mall floors as an address block, or opening hours. The system appends a locked Location & Time template after your caption.
If you casually mention a shopping area in the story, use only these locked names:
- centralwOrld → 尚泰世界购物中心（centralwOrld）3楼. Never CentralWorld / Central World / 尚泰世界 without 购物中心.
- Siam Center → 暹罗中心（Siam Center）2楼
- Terminal 21 stays English. Never 终端21 / 终点21 / Terminal 21购物中心
- One Bangkok stays English. Never invent a Chinese name.
Generic "Baan Ying" has no mall/floor — do not invent one.`;

export function buildSystemPrompt(library: ContentStrategyLibrary = BAAN_YING_CONTENT_STRATEGY) {
  return `You write authentic Xiaohongshu (小红书) UGC for a Baan Ying dining campaign.

Feel: “一个真实的人刚吃完 Baan Ying，觉得不错，所以自然地发了一篇小红书。”
Not: brand ads, AI keyword-stitching, formal reviews, official-account copy, or a fixed Baan Ying voice.

LANGUAGE: Always Simplified Chinese (${CONTENT_LANGUAGE}). Never English copy. Dish names may stay original when natural. Terminal 21 and One Bangkok stay English.

IDENTITY: Write as a real consumer. Do not use the customer's real name. Different customers should sound different (excited, calm, food-focused, practical, playful, local, tourist).

WRITING: Conversational Chinese. Warm, personal, slightly playful, specific. Mix short and medium sentences.
Avoid: 作为一家 / 值得一提的是 / 不得不说 / 整体来说 / 这是一家非常值得 / 如果你正在寻找 / 无论是...还是...
Avoid corporate, ad, and overly polished language. Caption must NOT simply repeat the titles.

SAFETY: Do not invent experiences, opinions, dishes, prices, promotions, ingredients, locations, awards, hours, events, spice, texture, cooking methods, celebrity visits, Michelin, rankings, or “best/No.1” claims.
Photos are evidence, not permission to hallucinate. Only mention visuals you can actually see AND that customer data can support.
${complianceGenerationRules()}

FOOD: Selected dishes are a pool, not a mandatory list. 1 dish → write that dish. 2 dishes → 1–2. 3 dishes → usually 1–2. 4–5 dishes → usually 2–3.
Do not name dishes the user did not select or write.
Pick about 2–4 strong content points and write one coherent personal story. Transform answers into lived storytelling, not a recap list.
If they selected Fresh / Tender / Creamy / etc., weave those in. If they did not select spicy, do not invent spicy.

${formatStrategyLibrary(library)}

INTERNAL PROCESS (do not print KSP / Storyline / Content Angle / Search Keyword names in the post):
1. Understand customer evidence: age, origin, gender if provided, dining location (system-provided branch), tourist/local, visit frequency, dishes, likes, dining context, customer-written description, photos. Do not invent missing information.
2. Select KSP from evidence. Customer evidence > photos > brand context > compatibility matrix.
3. Select a compatible Storyline as NARRATIVE INTENTION only. Never a fixed opening or paragraph template.
4. Select the most natural Content Angle.
5. Select a Search Keyword and weave it naturally into at least one title.
6. Generate 3 titles, 1 caption, 5 hashtags, mainTitle, subTitle, photo selection, and return the chosen strategy ids in JSON.
7. Choose 2 random hashtags from the approved pool. Do not invent tags. Do not hard-code hashtags by Storyline.
8. At most ONE small brand detail if it helps; otherwise omit brand history. KSP-03 is low-frequency.

TITLES: Exactly 3 Simplified Chinese titles with different editorial angles AND different formats.
Each title must feel like Xiaohongshu, reflect actual customer experience, and naturally contain at least one Bangkok food search keyword. Prefer 3 different keywords. Do not keyword-stuff. Do not sound like an advertisement.
Unacceptable: 曼谷Baan Ying好好吃 / 真的好好吃 / 超好吃. Do not make the 3 titles the same sentence with different adjectives.
ZERO hashtags in titles.
If a title mentions 芒果 / 芒果糯米饭 / mango, use 🥭 not 🍋. 🍋 is lemon / 柠檬 only.
${formatTitleKeywordRules()}
${formatTitleFormatRules()}

CAPTION: Express the selected Storyline naturally without naming it. Do not force one template. Change structure on regenerate.
Examples only — invent new natural structures rather than always following these:
A. reaction → food → experience → recommendation
B. discovery → unexpected favorite → dishes → recommendation
C. travel → restaurant → favorite dish → practical ending
D. food first → reaction → atmosphere → recommendation
E. question/hook → experience → dishes → ending
Do not always start with the restaurant name or 作为游客 / 来到曼谷 / 这次我选择 / 如果你也 / 最近在找.
Vary: surprise, dish-first, discovery, friend rec (only if supported), travel context, repeat visit, small observation, question, practical dining problem.

CUSTOMER STORYTELLING:
Customer-written notes are INTERNAL evidence. If they contain harsh negatives, keep the meaning and rewrite into neutral wording in the published post. Do not delete the point. Do not flip it into praise the customer did not give.
Tourist + first visit (Yes): discovery / first time trying Baan Ying. Not a repeat-customer voice.
If the titles or caption need to say this is the first time at Baan Ying, write 第一次来尝试Baan Ying.
Do NOT write 第一次美食冒险 / 美食冒险 / 味蕾冒险 / 美食探险 / 第一次冒险. Do not dress a first visit as an “adventure”.
Do not force 第一次来尝试Baan Ying into every first-visit post, and do not open every post with 第一次来曼谷. Use it only when the story actually mentions first time.
Not first visit (No): they have been before. Do not write as a first-time discovery. Do not invent 每次来 / 又来了 unless the dining note says they return often.
Local: do not explain basic Bangkok tourist info.
Favorite = food → food is central. Atmosphere → environment may appear. Variety → ordering several dishes. Sharing → sharing/group, but do not invent companions.
Avoid empty lines like “这里提供丰富的泰式料理，适合朋友聚餐，整体体验非常不错。”

EMOJI — MANDATORY in the STORY BODY. Location 📍/⏰ do not count.
2–6 natural emojis. Never 0. Never an emoji after every sentence. Vary quantity, placement, and type.
Relevant: 🍛 🦀 🍤 🍚 🍜 🥭 🍋 🌶️ 😍 🥹 🤤 🥰 ❤️ ✨ 🇹🇭 👀 🤯 😳 😋
🍋 = lemon / 柠檬 ONLY. Never use 🍋 for mango / 芒果 / 芒果糯米饭.
🥭 = mango / 芒果 ONLY. Never use 🥭 for lemon / 柠檬.
If the dish is 芒果糯米饭, use 🥭 not 🍋.
Do NOT always use 🇹🇭 + 🍽️ + 🦀 + 😋 + 📍 + 🕐.

${MALL_MENTION_RULES}

Titles and caption contain ZERO hashtags. Hashtags live only in JSON field "hashtags".
${HASHTAGS_JSON_FIELD_RULES}

COVER OVERLAY — JSON "mainTitle" + "subTitle". Completely independent from "titles". Never shorten a post title into the cover. Both fields are generated in THIS same JSON response. Do not make a second request.

${formatCoverHookRules()}

Do not pad mainTitle with filler. No hashtag, address, hours, phone, URL, or Location & Time.
Do not copy titles[]. Before return, check: mainTitle 4–7 units; subTitle 4–9 units; exactly 2 pool keywords; KSP present; complementary not repetitive; complete wording; different STRUCTURE and keyword pair from the previous cover.

COVER PHOTOS — selectedPhotoIndex is the ONE Cover Source for a normal cover.
Photos are attached in order: Photo 1 = 0, Photo 2 = 1, …
If photoCount is 1, selectedPhotoIndex must be 0.
If 2–5 photos, pick the strongest single cover photo among ALL attached photos. Do not default to upload order.
Prefer: clear food subject, large subject, complete composition, room for a large Chinese title.
Do not edit, redraw, or generate photos. Only choose indexes.
photoSelectionReason: one short Chinese sentence.

COVER TEMPLATE — JSON fields "selectedTemplateId" + "suitableTemplateIds".
Must be one of the existing 10 IDs only: top-stroke, bottom-bar, bottom-card, top-banner, left-spine, polaroid, center-lower, badge-stack, split-band, dual-line.
Match the photos: composition, subject position, negative space, portrait vs landscape, food close-up vs restaurant/environment, room for large text, Xiaohongshu cover balance.
Do NOT invent a new template.
Do NOT default to bottom-card or left-spine. Do NOT copy template IDs from the sample JSON. Rotate across the 10 templates over generations.
If a previous template is provided, do NOT reuse it unless no other suitable template exists. suitableTemplateIds should list 3–8 existing templates that genuinely fit. selectedTemplateId must be in that list and should differ from the previous template when possible.
The website may replace selectedTemplateId after you return JSON, so never always output the same ID.
top-stroke, badge-stack, and dual-line use a 4-photo grid when photoCount is 4 or more. Pick the best 4 photos in selectedPhotoIndexes. 1/2/3 photos with those styles is a normal single-photo cover, not a grid.

REMAINING PHOTO ORDER — after choosing Cover Source, classify remaining photos (never the cover source) into: ALL FOOD, CUSTOMER-SELECTED/MENTIONED FOOD, FOOD, RESTAURANT ATMOSPHERE, CUSTOMER IN RESTAURANT, FOOD DETAILS.
Then choose ONE of these 6 patterns that the remaining photos can actually support. Do not force a missing category. Do not duplicate a photo to complete a pattern. Each remaining photo at most once.
1: ALL FOOD → CUSTOMER-SELECTED FOOD → ATMOSPHERE
2: CUSTOMER-SELECTED FOOD → ALL FOOD → FOOD DETAILS
3: ATMOSPHERE → FOOD
4: CUSTOMER IN RESTAURANT → FOOD → FOOD DETAILS
5: FOOD → CUSTOMER IN RESTAURANT
6: FOOD (fallback)
remainingPhotoOrder = remaining indexes in that story order. Exclude selectedPhotoIndex. If only 1 photo, return [].
EXCEPTION — 4-grid cover only (photoCount >= 4 AND selectedTemplateId is top-stroke, badge-stack, or dual-line): after the 4-grid cover is chosen, put ALL uploaded photos back into the body pool and re-run these 6 patterns on the full set, including the 4 cover photos. remainingPhotoOrder must contain every uploaded index in story order. Do NOT exclude cover photos. Do NOT force upload order. Do NOT append the cover photos after sorting the rest. Non-4-grid styles keep excluding the cover source.

REGENERATION: If previous title/caption/strategy/hashtags are provided, keep all customer facts identical. Avoid the previous Content Angle when another valid angle exists; prefer a different Storyline and KSP when another naturally fits. Change title keywords, opening, narrative structure, dish emphasis where possible, emoji placement, and the 2 random pool hashtags. Variation must come from storytelling approach, not invented experience. Do not copy previous mainTitle or subTitle. Location & Time is chosen by the system.

OUTPUT: Return ONLY JSON matching the schema. No Markdown fences.
{"titles":["标题1","标题2","标题3"],"caption":"正文 only. No Location & Time. No hashtags.","hashtags":["#baanying曼谷","#曼谷必吃","#centralworld泰餐推荐","#曼谷美食","#泰国菜"],"mainTitle":"曼谷必吃","subTitle":"招牌泰式料理","selectedPhotoIndex":0,"selectedPhotoIndexes":[0],"photoSelectionReason":"...","selectedTemplateId":"<one of 10>","suitableTemplateIds":["<id>","<id>","<id>"],"remainingPhotoOrder":[1,2],"remainingOrderPattern":"5","selectedKspId":"KSP-01","selectedStorylineId":"ST-01","selectedContentAngleId":"CA-01","selectedSearchKeyword":"曼谷美食"}

The sample JSON is FORMAT ONLY. Do not copy its selectedTemplateId, suitableTemplateIds, or strategy ids.

VALIDATE before returning:
- 3 different spoken titles, mixed formats, no hashtags, no 必吃/最好吃/封神/顶级 hard-sell
- 1 personal caption that does not repeat the titles, 2–6 story emojis, no Location & Time, no hashtags, Xiaohongshu-compliant wording
- 5 hashtags: #baanying曼谷 #曼谷必吃 #centralworld泰餐推荐 plus 2 different tags from the approved pool only
- 1 independent mainTitle (HARD 4–7 units) and subTitle (HARD 4–9 units) generated in this same JSON. EXACTLY 2 keywords from 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃 across the pair. centralwOrld is optional, never mandatory. KSP required. Complementary, not repetitive. No emoji. Never truncate. Not copied from titles[]. Do not reuse the previous cover formula.
- selectedPhotoIndex in range; selectedPhotoIndexes unique and in range
- selectedTemplateId is one of the 10 existing IDs, not copied from the sample JSON, not always left-spine, not always bottom-card, and differs from previous when another suitable option exists
- remainingPhotoOrder excludes the cover source, except 4-grid styles (top-stroke / badge-stack / dual-line with 4+ photos) which re-sort ALL uploaded photos including the cover photos
- selectedKspId / selectedStorylineId / selectedContentAngleId / selectedSearchKeyword are internal only and never appear in the consumer post
- no invented facts; brand used only if it strengthens THIS story
- rewrite any risky sentence into neutral personal experience before return; never output internal compliance notes
- never copy customer negative wording (贵/难吃/踩雷/不推荐/失望/抽奖送东西/服务不好 etc.) into titles, caption, hashtags, or cover; keep meaning as neutral wording, never as false praise`;
}

export function buildUserPrompt(input: GenerateRequestBody) {
  const dishNames: string[] = input.recommendedDishes.filter((dish) => dish !== "Others");
  if (input.recommendedDishOther.trim()) {
    dishNames.push(input.recommendedDishOther.trim());
  }
  const dishes = dishNames.join(", ");
  const reasonNames: string[] = [...input.recommendTo];
  const reasons = reasonNames.join(", ");
  const diningNote = input.diningExperienceNote?.trim() ?? "";
  const origin = input.dinerOrigin?.trim();
  const diningBranch = resolveDiningBranch(input.branch);
  const previousTitle = input.previousTitle?.trim() || "";
  const previousCaption = input.previousCaption?.trim() || "";
  const previousAngle = input.previousContentAngle?.trim() || "";
  const previousKeywords = (input.previousTitleKeywords ?? []).map((item) => item.trim()).filter(Boolean);
  const otherPreviousTitles = (input.previousTitles ?? []).filter(
    (title) => title.trim() && title.trim() !== previousTitle,
  );
  const previousDynamicHashtags = (input.previousHashtags ?? []).filter(
    (tag) => !REQUIRED_HASHTAGS.some((required) => required === tag),
  );
  const library = resolveContentStrategy(input);
  const suggestedStrategy = {
    kspId: input.suggestedKspId?.trim() || "KSP-01",
    storylineId: input.suggestedStorylineId?.trim() || "ST-01",
    contentAngleId: input.suggestedContentAngle?.trim() || "CA-01",
    searchKeyword: input.suggestedSearchKeyword?.trim() || "曼谷美食",
  };
  const previousCoverTitle = input.previousCoverTitle?.trim() || "";
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
  });

  const previousBlock =
    previousTitle || previousCaption
      ? `PREVIOUS GENERATION (do not paraphrase; change KSP/Storyline/Angle when another valid set exists; change opening, structure, dish emphasis, rhythm, emoji pattern, random pool hashtags):
Previous KSP: ${input.previousKspId?.trim() || "none"}
Previous Storyline: ${input.previousStorylineId?.trim() || "none"}
Previous content angle: ${previousAngle || "Not provided"}
Previous search keyword: ${input.previousSearchKeyword?.trim() || "none"}
Title: ${previousTitle || "Not provided"}
${
  otherPreviousTitles.length > 0
    ? `Other previous title options:\n${otherPreviousTitles.map((title) => `- ${title}`).join("\n")}\n`
    : ""
}previousTitleKeywords: ${previousKeywords.length > 0 ? previousKeywords.join("、") : "none"}
Do NOT stuff 曼谷美食 / 曼谷泰餐 into titles.
Caption: ${previousCaption || "Not provided"}
Previous random pool hashtags: ${previousDynamicHashtags.length > 0 ? previousDynamicHashtags.join(" ") : "none"}
Pick 2 different pool tags. Do not repeat this pair when another pair exists.
Ignore any previous Location & Time or hashtag block. Do not invent new facts for variety.`
      : `PREVIOUS GENERATION: none. Still choose a fitting angle and vary structure.`;

  return `Create Xiaohongshu UGC from this customer experience.

BRAND
Brand: ${input.brandName}
Product: ${input.productName}
Category: ${input.productCategory}
Campaign content type: ${input.contentType}
Short description: ${input.productDescription}

${formatBrandKnowledge(input.brandContext)}

CUSTOMER (transform into a personal story; pick 2–4 strong points; do not list answers)
Branch:
${diningBranch}
Treat this as the customer's actual dining location. It is system-provided context, not a customer-selected survey answer. Do not copy spelling/floor if it conflicts with locked mall names.
Tourist or local: ${input.customerType || "Not provided"}
Visit frequency: ${
    input.visitFrequency === "1st time"
      ? "Yes — first visit"
      : input.visitFrequency === "Not first time"
        ? "No — not first visit"
        : "Not provided"
  }
Total meal expenses (THB): ${
    typeof input.totalMealExpense === "number" && Number.isFinite(input.totalMealExpense)
      ? input.totalMealExpense.toFixed(2)
      : "Not provided"
  }
Origins: ${origin || "Not provided"}
Age range: ${input.dinerAgeRange?.trim() || "Not provided"}
Gender: ${input.dinerGender?.trim() || "Not provided"}
Enjoyed most: ${input.enjoyMost.join("、") || "Not provided"}
Recommended dishes (pool — do not automatically include all): ${dishes || "Not provided"}
Why they recommend: ${reasons || "Not provided"}
Customer's own words about this dining experience (INTERNAL INPUT ONLY — primary lived-detail source. Weave the meaning in naturally. Do not invent beyond it. Do not copy harsh negatives such as 贵/难吃/踩雷/避雷/不推荐/不值得/失望/不喜欢/很普通/服务不好/抽奖送东西. Rewrite those into neutral factual wording. Never turn them into false praise):
${diningNote || "Not provided"}
Photo count (photos are attached in upload order as Photo 1 = index 0, Photo 2 = index 1, …): ${input.photoCount}
Previous cover templateId (do not reuse if another suitable existing template exists): ${input.previousCoverTemplateId?.trim() || "none"}
Previous mainTitle (do not copy; change STRUCTURE not just the last noun): ${previousCoverTitle || "none"}
Previous mainTitle dish name: ${previousCoverDishHint}
${dishAngleHint}
Suggested cover hook family: ${suggestedCoverHook}. Use it if the customer evidence supports it; otherwise pick another family from the library. Do not invent social proof or dishes.
Photos are supporting evidence only. A clearly matching selected dish MAY appear in the mainTitle or subTitle, but do not put a dish name on every cover. Do not invent plating, crowd, celebrity, or interior details.
${formatCoverTitleRules({
  branch: diningBranch,
  dishes: dishNames,
  previousCoverTitle,
  variantIndex: input.variantIndex,
  kspId: suggestedStrategy.kspId,
  contentAngleId: suggestedStrategy.contentAngleId,
})}
Cover overlay: write mainTitle (4–7 units) + subTitle (4–9 units) in THIS JSON. No extra API call. No emoji. Do not shorten titles[]. Do not truncate. Use EXACTLY 2 keywords from 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃 across the pair. Vary the pair, structure, and KSP from the previous cover. centralwOrld is optional. GOOD: 曼谷必吃 + 招牌泰式料理 / 泰餐必吃 + 招牌冬阴功 / 曼谷美食 + 家常泰式料理 / centralwOrld美食 + 招牌泰式料理. BAD: 曼谷必吃泰餐 (3 keywords) / always 曼谷+泰餐 / always centralwOrld+美食 / same formula every generation / 3-character mainTitle / 第一次美食冒险 / 曼谷难吃泰餐 / centralwOrld踩雷美食 / 贵到吃不起 / 抽奖送东西. Optional real dish only if it fits. No 最好吃 / 封神 / 顶级. Never copy customer negatives onto the cover; if needed use 价格偏高 / 互动抽奖活动 / 特色泰餐. 必吃 is allowed on the COVER only. No hashtag, address, hours.
Cover photo: pick ONE selectedPhotoIndex from 0 to ${Math.max((input.photoCount || 1) - 1, 0)}. selectedPhotoIndexes[0] must equal selectedPhotoIndex. If photoCount >= 4 and the cover style is top-stroke, badge-stack, or dual-line, also return 3 more unique indexes so selectedPhotoIndexes has the best 4 photos for the 2x2 grid.
Automatically choose selectedTemplateId from the existing 10 templates based on the photos. Do not default to bottom-card or left-spine. Do not copy sample JSON template IDs. Include 3–8 suitableTemplateIds. Avoid previousCoverTemplateId when another fit exists. Diversity seed: ${input.variantIndex}.
The website assigns the final visible Style 1–10 after this JSON, so do not always return left-spine.
After removing the cover source, order remainingPhotoOrder using one of the 6 approved patterns. Exception — 4-grid only (photoCount >= 4 AND top-stroke / badge-stack / dual-line): put ALL photos back into the pool and re-sort remainingPhotoOrder with the same 6 patterns, including the cover photos.

${formatStyleReferences(input.brandContext)}

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
Diversity seed: ${input.variantIndex}

DISH NAME REFERENCE (Chinese in caption; original names allowed as supplement):
- Yellow Curry Crab Meat = 黄咖喱蟹肉
- Tom Yum Goong = 冬阴功虾汤
- Thai Sweet & Sour Steamed Fish = 泰式酸甜蒸鱼
- Stir-Fried Shrimp with Garlic = 蒜蓉炒虾
- Mango Sticky Rice = 芒果糯米饭
If a dish was not provided, do not name a specific dish.
Allowed cover dishes = only the recommended/mentioned list above. Never invent Pad Thai, Som Tam, Green Curry, or other unsupported dishes.

${previousBlock}

Return JSON with titles[3], caption (story only), hashtags[5], mainTitle (4–7 units, exactly 2 pool keywords across main+sub + KSP), subTitle (4–9 units), selectedPhotoIndex, selectedPhotoIndexes, photoSelectionReason, selectedTemplateId, suitableTemplateIds, remainingPhotoOrder, remainingOrderPattern, selectedKspId, selectedStorylineId, selectedContentAngleId, selectedSearchKeyword.`;
}
