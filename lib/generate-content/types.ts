export const GENERATE_CONTENT_LANGUAGE = "zh-CN" as const;
export const GENERATE_CONTENT_REQUIRED_HASHTAGS = [
  "#baanying曼谷",
  "#曼谷必吃",
  "#centralworld泰餐推荐",
] as const;

export type GenerateContentCampaign = {
  brand: string;
  brandType: string;
  campaign: string;
  product: string;
  category: string;
  contentType: string;
};

export type GenerateContentCustomer = {
  name: string;
  ageRange: string;
  origins: string;
  gender: string;
};

export type GenerateContentExperience = {
  branch: string;
  customerType: string;
  visitFrequency: string;
  enjoyedMost: string[];
  favoriteDish: string;
  recommendTo: string[];
};

export type GenerateContentPhotoMeta = {
  name: string;
  description: string;
};

export type GenerateContentRequest = {
  campaign: GenerateContentCampaign;
  customer: GenerateContentCustomer;
  experience: GenerateContentExperience;
  photos: GenerateContentPhotoMeta[];
};

export type GenerateContentResponse = {
  titles: [string, string, string];
  body: string;
  hashtags: [string, string, string, string, string];
};

export type GenerateContentErrorCode =
  | "missing_api_key"
  | "invalid_request"
  | "openai_error"
  | "invalid_ai_response";
