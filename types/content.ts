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
  "The food",
  "The flavors",
  "The presentation",
  "The variety of dishes",
  "The restaurant atmosphere",
  "The service",
  "The overall experience",
] as const;

export const RECOMMENDED_DISHES = [
  "Yellow Curry Crab Meat",
  "Tom Yum Goong",
  "Thai Sweet & Sour Steamed Fish",
  "Stir-Fried Shrimp with Garlic",
  "Mango Sticky Rice",
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

export type ProductFeedback = {
  branch: BaanYingBranch | "";
  customerType: CustomerType | "";
  visitFrequency: VisitFrequency | "";
  totalMealExpense: number | null;
  enjoyMost: EnjoyMost[];
  recommendedDishes: RecommendedDish[];
  recommendedDishOther: string;
  recommendTo: RecommendTo[];
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
  enjoyMost: [],
  recommendedDishes: [],
  recommendedDishOther: "",
  recommendTo: [],
  diningExperienceNote: "",
};

export function withDefaultBranch(feedback: ProductFeedback): ProductFeedback {
  return { ...feedback, branch: DEFAULT_BAAN_YING_BRANCH };
}

export type PhotoItem = {
  id: string;
  name: string;
  previewUrl: string;
  file: File;
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
  enjoyMost: EnjoyMost[];
  recommendedDishes: RecommendedDish[];
  recommendedDishOther: string;
  recommendTo: RecommendTo[];
  diningExperienceNote: string;
  photoCount: number;
  contentType: ContentType;
  productName: string;
  variantIndex: number;
  /**
   * Generated Xiaohongshu language. Must always be Simplified Chinese.
   * Never pass the website UI language ("en" | "zh") here.
   */
  contentLanguage: "zh-CN";
  dinerOrigin?: string;
  dinerAgeRange?: string;
  dinerGender?: string;
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
};
