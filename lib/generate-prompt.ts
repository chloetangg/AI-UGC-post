import { CONTENT_LANGUAGE } from "@/lib/i18n";
import { resolveDiningBranch } from "@/lib/locations";
import { HASHTAGS_JSON_FIELD_RULES, REQUIRED_HASHTAGS } from "@/lib/hashtags";
import { formatTitleFormatRules } from "@/lib/title-formats";
import { formatTitleKeywordRules } from "@/lib/title-keywords";
import { complianceGenerationRules } from "@/lib/compliance/prompt";
import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { formatCoverHookRules, suggestCoverHookFamily } from "@/lib/cover/cover-hooks";
import { formatCoverStyleFitRules } from "@/lib/cover/style-fit";
import { formatCoverTitleRules } from "@/lib/cover/cover-rules";
import { classifyCoverHookType, formatEvidencePriorityRules, previousPrimaryExperienceId } from "@/lib/content-evidence";
import { formatGenerationVariationRules, planGenerationVariation, type GenerationMemory } from "@/lib/generation-variation";
import { formatPartySizeRules } from "@/lib/party-size";
import { allDishNameHints, chineseFullDishName, formatCaptionDishNameRules } from "@/lib/cover/dish-names";
import { formatCaptionConsumerVoiceRules, formatNaturalHumanWritingRules } from "@/lib/caption-voice";
import { buildEvidenceMap, formatContentLockRules } from "@/lib/content-lock";
import { formatNarrativeFlowRules } from "@/lib/narrative-flow";
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
          "One Simplified Chinese story body. Follow THIS ROUND length band in the user prompt. Do not invent facts to hit a longer band. No hashtags. No Location & Time block.",
      },
      hashtags: {
        type: "array",
        description:
          "Exactly 5 hashtags: always include #baanying曼谷, plus 4 tags from the approved pool, in random order.",
        minItems: 5,
        maxItems: 5,
        items: { type: "string" },
      },
      mainTitle: {
        type: "string",
        description:
          "Independent Xiaohongshu COVER mainTitle. Must pass a natural Chinese check before output: complete grammar, native collocation, no typo/missing/repeated character, not keyword glue. Lived-experience headline first, then weave one natural phrase such as 曼谷必吃 / 曼谷美食 / 曼谷泰餐 / 曼谷吃什么 / 曼谷探店 only if it sits naturally. Never 曼谷超爱次来吃 / 曼谷很值得来吃 / 曼谷推荐来吃 / 曼谷好吃必吃. 4–10 units MAX, not a target — shorter complete lines win. Han=1, centralwOrld=1, Terminal 21/Siam Center/One Bangkok=2. No emoji. No ranking/absolute language: 最 / 第一 / 最爱 / 天花板 / No.1 / 全曼谷 — rewrite to a natural line, not 曼谷超爱. If a dish is named, use the approved cover short only. Never shorten titles[]. Never copy the previous cover formula.",
      },
      subTitle: {
        type: "string",
        description:
          "Independent COVER subTitle. ONE Xiaohongshu hook from a single customer evidence — curiosity/scene/emotion, not a flat 菜名+很好吃 line, not glued keywords, not slang or fake praise. 6–10 units. Approved dish shorts only. Do not repeat mainTitle. No 最/第一/最爱 ranking language (第一次/最近 OK); rewrite 最爱 to 超爱. No emoji. Never empty.",
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
          "For a normal cover, return [selectedPhotoIndex] only. If photoCount is 4 or more AND selectedTemplateId is top-stroke or dual-line, return exactly 4 unique indexes for the 2x2 grid (best photos first). selectedPhotoIndexes[0] must equal selectedPhotoIndex.",
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
          "dual-line",
          "top-banner",
          "polaroid",
          "center-lower",
          "photo-only",
        ],
        description:
          "Must be one of suitableTemplateIds. The website ignores this for the final Style and picks from suitableTemplateIds with history avoidance.",
      },
      suitableTemplateIds: {
        type: "array",
        description:
          "ONLY templateIds that pass photo-composition fit (subject not covered, not cropped). Analyze every uploaded photo. Do not list all 6 by default. If none fully fit, return [\"photo-only\"]. Must include selectedTemplateId.",
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
        description:
          "0-based indexes for the body carousel, unique, original uploaded photos only — never the composed cover image. Non-grid styles: exclude selectedPhotoIndex. Empty array if only 1 photo. Four-grid (photoCount >= 4 AND selectedTemplateId is top-stroke or dual-line): include EVERY uploaded index and re-sort with the 6 remaining-photo patterns. Do not drop the 4 grid photos. Do not copy selectedPhotoIndexes / the 2x2 tile order. Do not force upload order.",
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

Learn: start from a personal moment when that fits, not always the restaurant name; mix feeling + food + useful info only when the evidence supports them; conversational Chinese with mixed sentence lengths. Never copy a 3-beat 吃了什么→感受→推荐 skeleton.
Learn voice habits only (first person, spoken rhythm, mixed like/so-so when evidenced). Never copy, rewrite, or stitch reference sentences.`;
}

const MALL_MENTION_RULES = `Do NOT write Location & Time, 📍/⏰ blocks, mall floors as an address block, or opening hours. The system appends a locked Location & Time template after your caption.
If you casually mention a shopping area in the story, use only these locked names:
- centralwOrld → 尚泰世界购物中心（centralwOrld）3楼. The ONLY approved Chinese name is 尚泰世界购物中心. Never CentralWorld / Central World / 中央世界 / 中央世界购物中心 / 尚泰中央世界 / 尚泰世界中心 / 尚泰世界 without 购物中心.
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

WRITING: Conversational Chinese. Warm, personal, slightly playful, specific. Sentence length, paragraphing, and rhythm should change with this visit — not a house style.
Avoid: 作为一家 / 值得一提的是 / 不得不说 / 整体来说 / 这是一家非常值得 / 如果你正在寻找 / 无论是...还是...
Avoid corporate, ad, and overly polished language. Caption must NOT simply repeat the titles.

SAFETY: Do not invent experiences, opinions, dishes, prices, promotions, ingredients, locations, awards, hours, events, spice, texture, cooking methods, celebrity visits, Michelin, rankings, party size, companions, or “best/No.1” claims.
Photos are evidence, not permission to hallucinate. Only mention visuals you can actually see AND that customer data can support.
${complianceGenerationRules()}

FOOD: Selected dishes are a pool, not a mandatory list. 1 dish → write that dish. 2 dishes → 1–2. 3 dishes → usually 1–2. 4–5 dishes → usually 2–3.
Do not name dishes the user did not select or write.
Pick only the content points this visit actually supports and write one coherent personal story. Transform answers into lived storytelling, not a recap list. If there is little to say, stop after 2 sentences.
If they selected Fresh / Tender / Creamy / etc., weave those in. If they did not select spicy, do not invent spicy.

${formatStrategyLibrary(library)}

INTERNAL PROCESS (do not print KSP / Storyline / Content Angle / Search Keyword names in the post):
1. Extract ONE shared Evidence Map. diningExperienceNote is Priority 1. Then like/dislike/most memorable, favorite/recommended dish, reasons, enjoy-most, identity/scene. Brand/KSP/search keyword last.
2. Lock Primary Content from that map. Title, caption, and cover must share it. Do not pick a new hero dish per field.
3. Form PRIMARY EXPERIENCE, SECONDARY EXPERIENCE, FOOD ANGLE, SEARCH KEYWORD. Search keyword is SEO only.
4. Select KSP from evidence. Customer evidence > photos > brand context > compatibility matrix.
5. Select a compatible Storyline as NARRATIVE INTENTION only. Never a fixed opening or paragraph template.
6. Select the most natural Content Angle from the lived evidence — not a default dish-recommendation angle.
7. Select a Search Keyword and weave it naturally into at least one title. Do not let it become the topic.
8. Group facts first (scene / primary dish / supporting / other / overall). Re-order into a natural story — never form-answer order. Same-dish facts stay in one stretch. Attributes stay on the correct dish. After Ending, do not open a new dish thread. Then write Caption around Primary Content, then Titles, then Cover. Then cross-check they agree. Return the chosen strategy ids in JSON.
9. Choose 4 random hashtags from the approved pool. Always include #baanying曼谷. Shuffle all 5. Do not invent tags. Do not hard-code hashtags by Storyline.
10. At most ONE small brand detail if it helps; otherwise omit brand history. KSP-03 is low-frequency.

TITLES: Exactly 3 Simplified Chinese titles with different editorial angles AND different formats.
Extract real customer facts FIRST, then write. Do not invent a trendy Xiaohongshu line and then justify it.
Title 1 = location + dining, or personal experience from customer-written input.
Title 2 = a DIFFERENT customer experience / selected enjoy-most highlight.
Title 3 = restaurant trait / dish / scene from the same real input.
Forbidden same-angle trio: 曼谷美食发现 / 曼谷美食推荐 / 曼谷泰餐推荐.
Each title must map to customer-written notes, selected enjoy-most, selected dishes/reasons, or confirmed restaurant facts. Never 曼谷今天也太好吃了 / 隐藏宝藏 / 本地人才知道 / 第一次来曼谷一定要吃 / 美食天花板 unless that exact idea is in the input.
Across titles[0–2] + mainTitle + subTitle, the exact token "centralwOrld" must appear at least once. Only this spelling. Weave naturally in one place. Never CentralWorld / centralworld / Central World / 尚泰世界. Do not repeat or stuff it.
Each title must feel like Xiaohongshu, reflect actual customer experience, and naturally contain at least one Bangkok food search keyword. Prefer 3 different keywords. Do not keyword-stuff. Do not sound like an advertisement.
Unacceptable: 曼谷Baan Ying好好吃 / 真的好好吃 / 超好吃. Do not make the 3 titles the same sentence with different adjectives.
ZERO hashtags in titles.
If a title mentions 芒果 / 芒果糯米饭 / mango, use 🥭 not 🍋. 🍋 is lemon / 柠檬 / 青柠 only.
Title emojis, if any, must be chosen from the same list as the caption. Title 1 must not always start with 🇹🇭.
${formatTitleKeywordRules()}
${formatTitleFormatRules()}

CAPTION: Express the selected Storyline naturally without naming it. Each Generate is an independent draft — new focus, new structure, new length, new sentence rhythm.
Narrative focus follows THIS ROUND FOCUS, then other real customer points. If they selected several enjoy-most / dish / reason items, describe more than one in natural UGC — do not only write “食物很好吃”.
Keep the fact, rewrite into complete Xiaohongshu sentences. Do not copy keyword stacks. Do not invent extra service/atmosphere/people.
THIS ROUND length band is mandatory when the evidence can support it. Thin input → stay short. Rich input → you may write longer. Never invent to fill Long / Extended.
Forbidden: the same opening every time; intro+experience+recommend+summary every time; listing every selected tag in one sentence; 145→147 character micro-edits on regenerate.
Do not always start with the restaurant name or 作为游客 / 来到曼谷 / 这次我选择 / 如果你也 / 最近在找.

${formatCaptionConsumerVoiceRules()}

${formatNaturalHumanWritingRules()}

CUSTOMER STORYTELLING:
Customer-written notes are INTERNAL evidence AND the highest-priority content source for titles, caption, AND cover — not caption-only.
If they contain harsh negatives, keep the meaning and rewrite into neutral wording in the published post. Do not delete the point. Do not flip it into praise the customer did not give.
Tourist + first visit (Yes): discovery / first time trying Baan Ying. Not a repeat-customer voice.
If the titles or caption need to say this is the first time at Baan Ying, write 第一次来尝试Baan Ying.
Do NOT write 第一次美食冒险 / 美食冒险 / 味蕾冒险 / 美食探险 / 第一次冒险. Do not dress a first visit as an “adventure”.
Do not force 第一次来尝试Baan Ying into every first-visit post, and do not open every post with 第一次来曼谷. Use it only when the story actually mentions first time.
Not first visit (No): they have been before. Do not write as a first-time discovery. Do not invent 每次来 / 又来了 unless the dining note says they return often.
Local: do not explain basic Bangkok tourist info.
Favorite = food → food is central. Atmosphere → environment may appear. Variety → ordering several dishes. Never invent companions or headcount.
If the customer did not write 几个人 / 一家几口 / 和朋友 / 和家人 / 和孩子 / 和伴侣 / 一个人 / 两个人 / 聚餐, do not mention any of those. Use 这次来吃 / 这顿吃下来.
Never infer party size from tourist/local, dish count, photo count, spend, or other answers. 4 dishes ≠ 几个人. ฿2,000 ≠ 一家人.
Avoid empty lines like “这里提供丰富的泰式料理，适合朋友聚餐，整体体验非常不错。”

EMOJI — titles and caption story body may use them. Cover overlay never uses emoji. Location 📍/⏰ do not count.
Use emojis like a real diner, not a quota. Count should change with the caption: a 2-sentence post may have 0–2; a longer one may have more. Never an emoji after every sentence. Never add emojis to pad length.
Approved list only: 🍛 🦀 🍤 🍚 🍜 🥭 🍋 🌶️ 😍 🥹 🤤 🥰 ❤️ ✨ 🇹🇭 👀 🤯 😳 😋
Pick the one that fits: 蟹→🦀, 虾→🍤, 芒果→🥭, 柠檬/青柠→🍋, 饭→🍚, 冬阴功→🍜, 咖喱→🍛. Otherwise a mood emoji, or 🇹🇭 only when the sentence is actually about Thailand/Bangkok.
🍋 = lemon / 柠檬 / 青柠 ONLY. Never use 🍋 for mango / 芒果 / 芒果糯米饭.
🥭 = mango / 芒果 ONLY. Never use 🥭 for lemon / 柠檬.
If the dish is 芒果糯米饭, use 🥭 not 🍋.
Do NOT always use 🇹🇭 + 🍽️ + 🦀 + 😋 + 📍 + 🕐.
Do NOT start every title 1 with 🇹🇭. Some title 1s have a list emoji, some have none. 🍽️ 📍 🕐 are not in the list.

${MALL_MENTION_RULES}

Titles and caption contain ZERO hashtags. Hashtags live only in JSON field "hashtags".
${HASHTAGS_JSON_FIELD_RULES}

COVER OVERLAY — JSON "mainTitle" + "subTitle". Completely independent from "titles". Never shorten a post title into the cover. Both fields are generated in THIS same JSON response. Do not make a second request.

${formatCoverHookRules()}

Do not pad mainTitle with filler. No hashtag, address, hours, phone, URL, or Location & Time.
Do not copy titles[]. Before return, check: mainTitle has 1–2 pool keywords and is a real headline; subTitle is a Xiaohongshu hook from ONE customer evidence (not 菜名+很好吃, not glued keywords, not 招牌泰式料理, not 让人惊艳, not slang). Would a real user write it? Does it spark curiosity without new facts? If a cover line names a dish, use the approved short only.

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

REGENERATION: If previous title/caption/strategy/hashtags are provided, keep all customer facts identical. This must read like a newly written post, not last time with swapped words. Avoid the previous Content Angle / Storyline / KSP when another valid set exists. Avoid previousCoverHookType / previousPrimaryExperience / previousTitleAngle. Follow THIS ROUND FOCUS, STRUCTURE, and LENGTH BAND. Change opening, fact order, which highlights get described, title angles, cover hook, and the 4 random pool hashtags. Do not copy the previous length band. Variation must come from storytelling approach, not invented experience. Do not copy previous mainTitle or subTitle. Location & Time is chosen by the system.

OUTPUT: Return ONLY JSON matching the schema. No Markdown fences.
{"titles":["标题1","标题2","标题3"],"caption":"正文 only. No Location & Time. No hashtags.","hashtags":["#曼谷美食","#baanying曼谷","#泰国菜","#曼谷打卡","#泰国"],"mainTitle":"曼谷泰餐遇到帅老板","subTitle":"服务也很舒服","selectedPhotoIndex":0,"selectedPhotoIndexes":[0],"photoSelectionReason":"...","selectedTemplateId":"<one of 10>","suitableTemplateIds":["<id>","<id>","<id>"],"remainingPhotoOrder":[1,2],"remainingOrderPattern":"5","selectedKspId":"KSP-01","selectedStorylineId":"ST-01","selectedContentAngleId":"CA-01","selectedSearchKeyword":"曼谷美食"}

The sample JSON is FORMAT ONLY. Do not copy its selectedTemplateId, suitableTemplateIds, or strategy ids.

VALIDATE before returning:
- 3 different spoken titles, mixed formats, no hashtags, no 必吃/最好吃/封神/顶级 hard-sell
- Title 1 + Title 2 + Title 3 + mainTitle + subTitle contain exact "centralwOrld" at least once; if missing, rewrite one line naturally before return
- every title / cover line is grounded in customer input, selected highlights, selected dishes/reasons, or confirmed restaurant facts — rewrite any generic ungrounded line
- 1 personal caption that does not repeat the titles; follows THIS ROUND structure + length band when evidence allows; no Location & Time, no hashtags; complete natural Chinese, no keyword-stacking
- if several customer selections exist, describe more than one of them; do not list tags; do not change their sentiment
- caption reads like a diner who just ate, not a brand/travel-media script; keep mixed like/so-so/dislike from evidence; no invented flaws; no forced summary CTA; no copied reference-review sentences
- 5 hashtags: always #baanying曼谷 plus 4 different tags from the approved pool, shuffled into random order
- 1 independent mainTitle that passed the natural Chinese check: lived-experience hook first; one keyword phrase only if natural; never 曼谷超爱次来吃 / 曼谷很值得来吃 / 曼谷推荐来吃; 4–10 units MAX (centralwOrld=1; Terminal 21/Siam Center/One Bangkok=2), do not pad; subTitle is one Xiaohongshu hook from a DIFFERENT slice of the same visit, 6–10 units, not concatenated, not 招牌泰式料理 / 让人惊艳 / 菜名很好吃, not slang. No 最/第一/最爱/天花板/冠军/全曼谷 ranking language — rewrite to a natural line, not 曼谷超爱. Approved cover dish shorts only. No emoji. Never a broken sentence. Not copied from titles[]. Do not reuse the previous cover formula.
- selectedPhotoIndex in range; selectedPhotoIndexes unique and in range
- suitableTemplateIds lists ONLY styles that pass composition fit (not all 6 by default); if none fit, ["photo-only"]; selectedTemplateId is one of those IDs and is not copied from the sample JSON
- remainingPhotoOrder uses original uploads only: four-grid re-sorts ALL photos; non-grid excludes the cover source and never repeats it
- selectedKspId / selectedStorylineId / selectedContentAngleId / selectedSearchKeyword are internal only and never appear in the consumer post
- no invented facts, party size, or companions; brand used only if it strengthens THIS story
- if the customer did not write who they dined with, titles/caption/cover use 这次来吃 / 这顿吃下来 and never 两个人 / 和朋友 / 一家三口 / 带家人 / 一个人来
- rewrite any risky sentence into neutral personal experience before return; never output internal compliance notes
- never copy customer negative wording (贵/难吃/踩雷/不推荐/失望/抽奖送东西/服务不好 etc.) into titles, caption, hashtags, or cover; keep meaning as neutral wording, never as false praise`;
}

export function buildUserPrompt(input: GenerateRequestBody) {
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

${formatBrandKnowledge(input.brandContext)}

CUSTOMER (transform into a personal story; use only the points this visit supports; do not list answers. Simple evidence → shorter caption. Richer evidence → naturally longer. Never pad.)
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
Customer's own words about this dining experience (INTERNAL INPUT ONLY — Priority 1 lived-detail source for titles AND caption AND cover. Weave the meaning in naturally. Do not invent beyond it. Do not copy harsh negatives such as 贵/难吃/踩雷/避雷/不推荐/不值得/失望/不喜欢/很普通/服务不好/抽奖送东西. Rewrite those into neutral factual wording. Never turn them into false praise. Never ignore this note in favor of 曼谷美食发现):
${diningNote || "Not provided"}
Photo count (photos are attached in upload order as Photo 1 = index 0, Photo 2 = index 1, …): ${input.photoCount}
Previous cover templateId (do not reuse if another suitable existing template exists): ${input.previousCoverTemplateId?.trim() || "none"}
Previous mainTitle (do not copy; change STRUCTURE not just the last noun): ${previousCoverTitle || "none"}
Previous cover hook type: ${previousCoverHookType}
Previous primary experience: ${previousPrimaryExperience || "none"}
Previous title angle: ${previousTitleAngle}
${formatEvidencePriorityRules(
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
${formatGenerationVariationRules(variationPlan, input.previousGenerationMemories as GenerationMemory[] | undefined)}
${formatContentLockRules(evidenceMap)}
${formatNarrativeFlowRules(lockContext, evidenceMap)}
${formatPartySizeRules({
  diningNote,
  enjoyMost: [...input.enjoyMost.filter((item) => item !== "其他"), input.enjoyMostOther?.trim() ?? ""].filter(Boolean),
})}
Previous mainTitle dish name: ${previousCoverDishHint}
${dishAngleHint}
Suggested cover hook family: ${suggestedCoverHook}. Use it if the customer evidence supports it; otherwise pick another family from the library. Do not invent social proof or dishes.
Photos are supporting evidence only. A clearly matching selected dish MAY appear in the mainTitle or subTitle, but do not put a dish name on every cover. Do not invent plating, crowd, celebrity, or interior details.
${formatCoverTitleRules({
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
Cover overlay: write mainTitle + subTitle in THIS JSON. No extra API call. No emoji. Lived experience first. mainTitle must pass the natural Chinese check before output. Weave one keyword phrase only if it sits naturally. Never 曼谷超爱次来吃 / 曼谷很值得来吃 / 曼谷推荐来吃 / 曼谷好吃必吃. 4–10 units MAX, not a target. GOOD: 老板很帅的曼谷泰餐 + 服务也很舒服 / 曼谷必吃泰菜 + 这口很合口味 / 曼谷吃什么？ + 逛完街来吃刚刚好. BAD: 曼谷超爱次来吃 + 这几道菜还想再点 / 曼谷centralwOrld泰餐美食必吃推荐. 必吃 is allowed on the COVER only. No hashtag, address, hours.
Cover photo: pick ONE selectedPhotoIndex from 0 to ${Math.max((input.photoCount || 1) - 1, 0)}. selectedPhotoIndexes[0] must equal selectedPhotoIndex. If photoCount >= 4 and the cover style is top-stroke or dual-line, also return 3 more unique indexes so selectedPhotoIndexes has the best 4 photos for the 2x2 grid.
Cover style: analyze ALL attached photos (subject, position, safe area, crop risk, faces, dishes, storefronts). Return suitableTemplateIds with ONLY styles that can sit on the photos without covering or cropping the main subject. Do not list all 6 unless they all fit. If none fully fit, return ["photo-only"]. selectedTemplateId must be inside that list; the website then picks the final Style with history avoidance. Do not copy sample JSON template IDs. Diversity seed: ${input.variantIndex}.
Body photos: original uploads only, never the composed cover file. Non-grid: exclude the cover source, then sort remainingPhotoOrder with one of the 6 patterns. Four-grid (photoCount >= 4 AND top-stroke / dual-line): keep ALL originals in the pool — including the 4 grid photos — and re-sort remainingPhotoOrder with the same 6 patterns. Do not copy the 2x2 order.

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

DISH NAME REFERENCE:
${formatCaptionDishNameRules()}
Never glue a dish together with price and first-visit in one subtitle.

${previousBlock}

Return JSON with titles[3], caption (story only), hashtags[5], mainTitle (at least one pool keyword, not stuffed), subTitle (one Xiaohongshu hook from one customer evidence, not a template), selectedPhotoIndex, selectedPhotoIndexes, photoSelectionReason, selectedTemplateId, suitableTemplateIds, remainingPhotoOrder, remainingOrderPattern, selectedKspId, selectedStorylineId, selectedContentAngleId, selectedSearchKeyword.`;
}
