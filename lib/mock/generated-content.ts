import {
  autoMatchTemplate,
  COVER_TEMPLATE_OPTIONS,
  parseRemainingPhotoIndexes,
} from "@/lib/cover/post-layout";
import { layoutCoverOverlay } from "@/lib/cover/cover-title";
import { coverFallbackPairs, shouldUseCoverLocation } from "@/lib/cover/cover-rules";
import {
  stripAllHashtagsFromCaption,
  validateHashtags,
  type GeneratedHashtags,
} from "@/lib/hashtags";
import { CONTENT_LANGUAGE } from "@/lib/i18n";
import {
  captionHoursForBranch,
  captionLocationLine,
  LOCATION_TIME_FORMAT_IDS,
  renderLocationTimeSection,
} from "@/lib/locations";
import type {
  ContentType,
  EnjoyMost,
  GeneratePostInput,
  GeneratedContent,
  RecommendedDish,
} from "@/types/content";

export const mockGeneratedContent: GeneratedContent = {
  titles: [
    "🇹🇭曼谷这家泰菜真的值得收藏！Baan Ying 好吃到想二刷🍽️",
    "来曼谷不知道吃什么？这家泰国餐厅可以先收藏！✨",
    "曼谷泰菜推荐｜Baan Ying 一次吃好多经典泰味😋",
  ],
  caption:
    `来曼谷当然要安排一顿泰国菜🇹🇭 这次吃到 Baan Ying，整体体验很适合和朋友一起约饭！从经典泰菜到各种适合分享的料理，一桌点起来超满足😋 如果你最近也在找曼谷餐厅，不妨把这家先收藏起来✨\n\n📍 尚泰世界购物中心（centralwOrld）3楼\n⏰ 10:00–22:00`,
  hashtags: validateHashtags(["#泰菜推荐", "#曼谷美食", "#曼谷探店"]),
  coverTitle: "曼谷必吃",
  coverSubtitle: "家常泰式料理",
  selectedPhotoIndex: 0,
  selectedPhotoIndexes: [0],
  photoSelectionReason: "食物主体清晰、构图完整，适合叠加标题。",
  selectedTemplateId: "bottom-card",
  suitableTemplateIds: ["bottom-card", "top-banner", "polaroid", "center-lower"],
  remainingPhotoIndexes: [],
  remainingOrderPattern: "6",
};

const CONTENT_OPENERS: Record<ContentType, string[]> = {
  "restaurant-recommendation": [
    "来曼谷当然要安排一顿泰国菜🇹🇭",
    "最近如果在找曼谷餐厅，Baan Ying 真的可以先收藏。",
  ],
  "food-review": [
    "这次吃完 Baan Ying，真实感受就是很适合慢慢坐下来吃。",
    "不是硬广口吻，就是这顿饭吃下来的分享。",
  ],
  "food-discovery": [
    "这次在曼谷挖到 Baan Ying，整体很有发现新店的感觉。",
    "如果最近也在找泰菜，这家真的可以记一下。",
  ],
  "must-try": [
    "来曼谷想吃泰菜的话，Baan Ying 我会先推。",
    "这顿吃完是会想二刷的那种。",
  ],
  "bangkok-food-guide": [
    "曼谷美食行程里，Baan Ying 可以放进去。",
    "不知道吃什么的时候，可以先从这家开始看。",
  ],
  "thai-food-guide": [
    "想吃经典泰味，Baan Ying 这顿很能代表。",
    "泰菜爱好者可以先把这家收着。",
  ],
  lifestyle: [
    "这顿饭的感觉很生活，适合和朋友慢慢吃。",
    "氛围很放松，拍照也自然。",
  ],
  "dining-experience": [
    "Baan Ying 这顿的用餐体验很舒服。",
    "从点餐到一起分享，整桌吃下来很满足。",
  ],
};

const DISH_HASHTAGS: Record<RecommendedDish, string> = {
  "Yellow Curry Crab Meat": "#黄咖喱蟹肉",
  "Tom Yum Goong": "#冬阴功",
  "Thai Sweet & Sour Steamed Fish": "#酸甜蒸鱼",
  "Stir-Fried Shrimp with Garlic": "#蒜蓉炒虾",
  "Mango Sticky Rice": "#芒果糯米饭",
  Others: "",
};

const ANGLE_HASHTAG_SETS = [
  ["#泰菜推荐", "#曼谷美食", "#曼谷探店"],
  ["#泰国菜", "#曼谷泰餐", "#曼谷吃什么"],
  ["#泰式料理", "#曼谷餐厅", "#泰国美食"],
] as const;

function mockDynamicHashtags(input: GeneratePostInput): GeneratedHashtags {
  const fromDishes = (input.recommendedDishes ?? [])
    .map((dish) => DISH_HASHTAGS[dish])
    .filter(Boolean);
  const angle = ANGLE_HASHTAG_SETS[input.variantIndex % ANGLE_HASHTAG_SETS.length];
  return validateHashtags([...fromDishes, ...angle]);
}

type CoverOverlay = { title: string; subtitle: string };

const DISH_COVER_OVERLAYS: Record<RecommendedDish, CoverOverlay[]> = {
  "Yellow Curry Crab Meat": [
    { title: "曼谷必吃", subtitle: "招牌咖喱蟹" },
    { title: "泰餐必吃", subtitle: "招牌咖喱蟹" },
    { title: "曼谷泰餐", subtitle: "招牌咖喱蟹" },
  ],
  "Tom Yum Goong": [
    { title: "曼谷必吃", subtitle: "招牌冬阴功" },
    { title: "泰餐必吃", subtitle: "招牌冬阴功" },
    { title: "曼谷泰餐", subtitle: "招牌冬阴功" },
  ],
  "Thai Sweet & Sour Steamed Fish": [
    { title: "曼谷必吃", subtitle: "招牌酸甜鱼" },
    { title: "泰餐必吃", subtitle: "招牌酸甜鱼" },
    { title: "曼谷泰餐", subtitle: "招牌酸甜鱼" },
  ],
  "Stir-Fried Shrimp with Garlic": [
    { title: "曼谷必吃", subtitle: "蒜蓉炒虾" },
    { title: "泰餐必吃", subtitle: "蒜蓉炒虾" },
    { title: "曼谷泰餐", subtitle: "蒜蓉炒虾" },
  ],
  "Mango Sticky Rice": [
    { title: "曼谷必吃", subtitle: "芒果糯米饭" },
    { title: "泰餐必吃", subtitle: "芒果糯米饭" },
    { title: "曼谷美食", subtitle: "芒果糯米饭" },
  ],
  Others: [],
};

const GENERIC_COVER_OVERLAYS: CoverOverlay[] = [
  { title: "曼谷必吃", subtitle: "家常泰式料理" },
  { title: "泰餐必吃", subtitle: "招牌菜值得试" },
  { title: "曼谷泰餐", subtitle: "超人气招牌菜" },
  { title: "美食必吃", subtitle: "家常泰式料理" },
  { title: "曼谷美食", subtitle: "泰式家常料理" },
];

function mockCoverOverlay(input: GeneratePostInput): CoverOverlay {
  const variant = input.variantIndex ?? 0;
  const note = input.diningExperienceNote ?? "";
  const dishes = [
    ...(input.recommendedDishes ?? []).filter((item) => item !== "Others"),
    input.recommendedDishOther?.trim() ?? "",
  ].filter(Boolean);
  const context = {
    branch: input.branch,
    dishes,
    variantIndex: variant,
    previousCoverTitle: input.previousCoverTitle,
    kspId: input.suggestedKspId,
    contentAngleId: input.suggestedContentAngle,
  };
  if (shouldUseCoverLocation(context)) {
    const pairs = coverFallbackPairs(context);
    return layoutCoverOverlay(
      pairs[variant % pairs.length]?.title ?? "曼谷必吃",
      pairs[variant % pairs.length]?.subtitle ?? "家常泰式料理",
      [],
      context,
    );
  }
  if (/温馨|家常|家里|家的感觉/.test(note)) {
    const atmosphere: CoverOverlay[] = [
      { title: "曼谷必吃", subtitle: "家常温馨料理" },
      { title: "曼谷美食", subtitle: "温馨家常味道" },
      { title: "必吃泰餐", subtitle: "温馨家常味道" },
    ];
    return layoutCoverOverlay(
      atmosphere[variant % atmosphere.length].title,
      atmosphere[variant % atmosphere.length].subtitle,
      [],
      context,
    );
  }
  const dish = (input.recommendedDishes ?? []).find((item) => item !== "Others");
  const fromDish = dish ? DISH_COVER_OVERLAYS[dish] : [];
  const picked =
    fromDish.length > 0
      ? fromDish[variant % fromDish.length]
      : note.includes("芒果")
        ? DISH_COVER_OVERLAYS["Mango Sticky Rice"][variant % 3]
        : note.includes("咖喱")
          ? DISH_COVER_OVERLAYS["Yellow Curry Crab Meat"][variant % 3]
          : note.includes("冬阴功")
            ? DISH_COVER_OVERLAYS["Tom Yum Goong"][variant % 3]
            : GENERIC_COVER_OVERLAYS[variant % GENERIC_COVER_OVERLAYS.length];
  return layoutCoverOverlay(picked.title, picked.subtitle, [], context);
}

function mockCoverLayout(input: GeneratePostInput, coverIndex: number) {
  const photoCount = Math.max(input.photoCount || 1, 1);
  const selectedTemplateId = autoMatchTemplate({
    selected: "",
    suitable: COVER_TEMPLATE_OPTIONS.map((item) => item.id),
    previousTemplateId: input.previousCoverTemplateId,
  });
  return {
    selectedTemplateId,
    suitableTemplateIds: COVER_TEMPLATE_OPTIONS.map((item) => item.id).filter(
      (id) => id !== input.previousCoverTemplateId,
    ),
    remainingPhotoIndexes: parseRemainingPhotoIndexes(
      [],
      coverIndex,
      photoCount,
      selectedTemplateId,
    ),
    remainingOrderPattern: photoCount <= 2 ? "6" : "1",
  };
}

function joinChinese(parts: string[]) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}、${parts[1]}`;
  return `${parts.slice(0, -1).join("、")}和${parts[parts.length - 1]}`;
}

/**
 * Mock AI generation.
 *
 * CONTENT LANGUAGE RULE:
 * Always return Simplified Chinese (zh-CN) titles, caption, and hashtags.
 * The website UI language ("en" | "zh") is ignored here on purpose.
 * Future OpenAI calls must use CONTENT_LANGUAGE and must not follow UI language.
 */
export function getMockGeneratedContent(input: GeneratePostInput): GeneratedContent {
  const contentLanguage = CONTENT_LANGUAGE;
  void contentLanguage;
  void input.contentLanguage;

  const overlay = mockCoverOverlay(input);
  const hashtags = mockDynamicHashtags(input);
  const locationLine = captionLocationLine(input.branch);
  const hoursDisplay = captionHoursForBranch(input.branch);
  const locationSection = renderLocationTimeSection(
    input.requiredLocationFormat || LOCATION_TIME_FORMAT_IDS[input.variantIndex % 6],
    locationLine,
    hoursDisplay,
  );

  if (input.variantIndex % 3 === 0) {
    const base = mockGeneratedContent.caption.replace(/\n\n📍[\s\S]*$/, "").trim();
    return {
      titles: [...mockGeneratedContent.titles] as GeneratedContent["titles"],
      caption: stripAllHashtagsFromCaption(
        locationSection ? `${base}\n\n${locationSection}` : base,
      ),
      hashtags,
      coverTitle: overlay.title,
      coverSubtitle: overlay.subtitle,
      selectedPhotoIndex: 0,
      selectedPhotoIndexes: [0],
      photoSelectionReason: mockGeneratedContent.photoSelectionReason,
      ...mockCoverLayout(input, 0),
    };
  }

  const enjoy =
    input.enjoyMost.length > 0 ? input.enjoyMost : (["The food"] as EnjoyMost[]);
  const highlightText = joinChinese(enjoy.map((item) => item.replace(/^The /, "").toLowerCase()));
  const sceneText = [input.customerType, input.visitFrequency].filter(Boolean).join("、") || "这次用餐";
  const photoLine =
    input.photoCount > 1
      ? `这次随手拍了 ${input.photoCount} 张，菜单和桌边氛围都有入镜。`
      : "照片是吃饭时随手拍的，没有修得很假。";
  const openers = CONTENT_OPENERS[input.contentType];
  const opener = openers[input.variantIndex % openers.length];
  const firstHighlight = enjoy[0]?.replace(/^The /, "") ?? "food";
  const firstScene = input.branch || "Baan Ying";

  const titlePool: [string, string, string][] = [
    [
      `🇹🇭曼谷这家泰菜真的值得收藏！Baan Ying 好吃到想二刷🍽️`,
      `来曼谷不知道吃什么？这家泰国餐厅可以先收藏！✨`,
      `曼谷泰菜推荐｜Baan Ying 一次吃好多经典泰味😋`,
    ],
    [
      `${firstScene}就来 Baan Ying，${firstHighlight}`,
      `Baan Ying 这顿：${highlightText}`,
      `曼谷吃饭可以先看这家｜${sceneText}`,
    ],
    [
      `Baan Ying 真实用餐分享：${firstHighlight}`,
      `${sceneText}都很适合`,
      `这顿泰菜${highlightText}✨`,
    ],
  ];

  const titles = titlePool[input.variantIndex % titlePool.length];
  const caption = [
    opener,
    photoLine,
    `最有感的是${highlightText}，${sceneText}都很合适，一桌点起来也很好分享。`,
    "整体氛围很放松，吃起来像真实探店，不像硬广。",
    "如果你最近也在找曼谷餐厅，不妨把 Baan Ying 先收藏起来✨",
    locationSection,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    titles,
    caption: stripAllHashtagsFromCaption(caption),
    hashtags,
    coverTitle: overlay.title,
    coverSubtitle: overlay.subtitle,
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: mockGeneratedContent.photoSelectionReason,
    ...mockCoverLayout(input, 0),
  };
}
