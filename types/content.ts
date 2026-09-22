import { BAAN_YING_BRANCHES, DEFAULT_BAAN_YING_BRANCH, type BaanYingBranch, type LocationTimeFormatId } from "@/lib/locations";

export { BAAN_YING_BRANCHES, DEFAULT_BAAN_YING_BRANCH };
export type { BaanYingBranch, LocationTimeFormatId };

export const PRODUCT_HIGHLIGHTS = [
  "Thai food",
  "Authentic Thai flavors",
  "Variety of Thai dishes",
  "Great for sharing",
  "Restaurant experience",
  "Food discovery",
  "Bangkok dining",
] as const;

export const USAGE_SCENES = [
  "Lunch",
  "Dinner",
  "Weekend",
  "Family Meal",
  "Friends Gathering",
  "Bangkok Food Trip",
  "Thai Food Experience",
  "Restaurant Hopping",
] as const;

export const CONTENT_TYPES = [
  { value: "restaurant-recommendation", label: "Restaurant Recommendation" },
  { value: "food-review", label: "Food Review" },
  { value: "food-discovery", label: "Food Discovery" },
  { value: "must-try", label: "Must Try" },
  { value: "bangkok-food-guide", label: "Bangkok Food Guide" },
  { value: "thai-food-guide", label: "Thai Food Guide" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "dining-experience", label: "Dining Experience" },
] as const;

export const CONTENT_STYLES = [
  "Authentic",
  "Casual",
  "Lifestyle",
  "Foodie",
  "Friendly Recommendation",
  "Personal Experience",
  "Travel & Food",
] as const;

export const CUSTOMER_TYPES = ["Tourist", "Local"] as const;

export const VISIT_FREQUENCIES = ["1st time", "Not first time"] as const;

export const ENJOY_MOST = [
  "有中文菜单",
  "餐厅面积很大",
  "在购物商场里的泰餐连锁",
  "刚刚翻新环境很好",
  "店员服务热情周到",
  "店里菜品选择丰富",
  "食物味道正宗美味",
  "餐厅风格有满满的家庭式温馨氛围",
  "支付可以使用支付宝",
  "其他",
] as const;

export const ENJOY_MOST_OTHER = "其他";

export const MEAL_EXPENSE_RANGES = [
  "฿1-200",
  "฿200-400",
  "฿400-600",
  "฿600-800",
  "฿800-1,000",
  "฿1,000-1,200",
  "฿1,200-1,400",
  "฿1,400-1,600",
  "฿1,600-1,800",
  "฿1,800-2,000",
  "฿2,000+",
] as const;

export const RECOMMENDED_DISHES = [
  "River Prawn Tom Yum",
  "Crab Meat Curry",
  "Stir-Fried Morning Glory",
  "Pineapple Fried Rice",
  "Mango Sticky Rice",
  "Scrambled Egg Rice",
  "Lemon Sea Bass",
  "Garlic Shrimp",
  "Sweet and Sour River Prawns",
  "Green Curry Beef",
  "Others",
] as const;

export const RECOMMEND_TO = [
  "Delicious",
  "Flavorful",
  "Authentic",
  "Fresh",
  "Tender",
  "Crispy",
  "Fragrant",
  "Rich",
  "Creamy",
  "Satisfying",
  "Well-balanced",
] as const;

export type ProductHighlight = (typeof PRODUCT_HIGHLIGHTS)[number];
export type UsageScene = (typeof USAGE_SCENES)[number];
export type ContentType = (typeof CONTENT_TYPES)[number]["value"];
export type ContentStyle = (typeof CONTENT_STYLES)[number];
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type VisitFrequency = (typeof VISIT_FREQUENCIES)[number];
export type EnjoyMost = (typeof ENJOY_MOST)[number];
export type RecommendedDish = (typeof RECOMMENDED_DISHES)[number];
export type RecommendTo = (typeof RECOMMEND_TO)[number];
export type MealExpenseRange = (typeof MEAL_EXPENSE_RANGES)[number];

export type ProductFeedback = {
  branch: BaanYingBranch | "";
  customerType: CustomerType | "";
  visitFrequency: VisitFrequency | "";
  totalMealExpense: number | null;
  mealExpenseRange: MealExpenseRange | "";
  enjoyMost: EnjoyMost[];
  enjoyMostOther: string;
  recommendedDishes: RecommendedDish[];
  recommendedDishOther: string;
  recommendTo: string[];
  recommendToOther: string;
  diningExperienceNote: string;
};

export const MIN_DINING_EXPERIENCE_NOTE_LENGTH = 10;

/**
 * English counts by word ("you" = 1). Chinese counts by character.
 * Punctuation and whitespace are ignored.
 */
export function countDiningExperienceUnits(note: string) {
  const text = note.normalize("NFC").trim();
  if (!text) return 0;

  const chineseChars = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const withoutChinese = text.replace(/\p{Script=Han}/gu, " ");
  const words =
    withoutChinese.match(/\p{L}[\p{L}\p{N}]*(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];

  return chineseChars + words.length;
}

export function isDiningExperienceNoteComplete(note: string) {
  return countDiningExperienceUnits(note) >= MIN_DINING_EXPERIENCE_NOTE_LENGTH;
}

export const emptyProductFeedback: ProductFeedback = {
  branch: DEFAULT_BAAN_YING_BRANCH,
  customerType: "",
  visitFrequency: "",
  totalMealExpense: null,
  mealExpenseRange: "",
  enjoyMost: [],
  enjoyMostOther: "",
  recommendedDishes: [],
  recommendedDishOther: "",
  recommendTo: [],
  recommendToOther: "",
  diningExperienceNote: "",
};

export function withDefaultBranch(feedback: ProductFeedback): ProductFeedback {
  return {
    ...feedback,
    branch: DEFAULT_BAAN_YING_BRANCH,
    mealExpenseRange: (MEAL_EXPENSE_RANGES as readonly string[]).includes(feedback.mealExpenseRange)
      ? feedback.mealExpenseRange
      : "",
    enjoyMost: feedback.enjoyMost.filter((item): item is EnjoyMost =>
      (ENJOY_MOST as readonly string[]).includes(item),
    ),
    recommendedDishes: feedback.recommendedDishes.filter((item): item is RecommendedDish =>
      (RECOMMENDED_DISHES as readonly string[]).includes(item),
    ),
    recommendTo: Array.isArray(feedback.recommendTo)
      ? feedback.recommendTo.filter((item) => typeof item === "string" && item.trim())
      : [],
  };
}

export type PhotoItem = {
  id: string;
  name: string;
  previewUrl: string;
  thumbUrl?: string;
  file: File;
  uploadFile?: File;
};

export const DEFAULT_COVER_TEMPLATE_ID = "top-stroke";
export const DEFAULT_COVER_FONT_ID = "jiangchengheiti";

export type GeneratedContent = {
  titles: [string, string, string];
  caption: string;
  hashtags: [string, string, string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  selectedPhotoIndex: number;
  selectedPhotoIndexes: number[];
  photoSelectionReason: string;
  selectedTemplateId: string;
  suitableTemplateIds: string[];
  remainingPhotoIndexes: number[];
  remainingOrderPattern: string;
  selectedKspId?: string;
  selectedStorylineId?: string;
  selectedContentAngleId?: string;
  selectedSearchKeyword?: string;
};

export type CoverState = {
  coverTitle: string;
  coverSubtitle: string;
  selectedPhotoIndex: number;
  selectedPhotoIndexes: number[];
  generatedCoverImageUrl: string | null;
  selectedCoverTemplateId: string;
  selectedFontId: string;
  templateFontIds: Record<string, string>;
  coverSourcePhotoId: string | null;
  remainingPhotoIds: string[];
  error: string | null;
};

export type ResultDraft = {
  selectedTitleIndex: 0 | 1 | 2;
  caption: string;
  hashtags: string[];
};

export type GeneratePostInput = {
  branch: BaanYingBranch | "";
  customerType: CustomerType | "";
  visitFrequency: VisitFrequency | "";
  totalMealExpense?: number | null;
  mealExpenseRange?: MealExpenseRange | "";
  enjoyMost: EnjoyMost[];
  enjoyMostOther?: string;
  recommendedDishes: RecommendedDish[];
  recommendedDishOther: string;
  recommendTo: string[];
  recommendToOther?: string;
  diningExperienceNote: string;
  photoCount: number;
  contentType: ContentType;
  productName: string;
  variantIndex: number;
  /**
   * Generated Xiaohongshu language. Must always be Simplified Chinese.
   * Never pass the website UI language ("en" | "zh" | "th") here.
   */
  contentLanguage: "zh-CN";
  dinerOrigin?: string;
  dinerAgeRange?: string;
  dinerGender?: string;
  dinerCountryIso2?: string;
  dinerCountryCode?: string;
  suggestedKspId?: string;
  suggestedStorylineId?: string;
  suggestedSearchKeyword?: string;
  previousKspId?: string;
  previousStorylineId?: string;
  previousSearchKeyword?: string;
  previousTitle?: string;
  previousCaption?: string;
  previousTitles?: string[];
  previousLocationFormat?: LocationTimeFormatId | "";
  previousLocationFormats?: LocationTimeFormatId[];
  requiredLocationFormat?: LocationTimeFormatId | "";
  previousHashtags?: string[];
  previousContentAngle?: string;
  suggestedContentAngle?: string;
  previousTitleKeywords?: string[];
  previousCoverTemplateId?: string;
  previousCoverTitle?: string;
  previousCoverHookType?: string;
  previousPrimaryExperience?: string;
  previousTitleAngle?: string;
  previousGenerationMemories?: Array<{
    contentFocus: string;
    openingStyle: string;
    informationPriority: string[];
    dishOrder: string[];
    structureType: string;
    lengthLevel: string;
  }>;
  campaignId?: string;
  submissionId?: string;
};
