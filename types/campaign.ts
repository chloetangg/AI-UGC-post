import type { ContentStrategyLibrary } from "@/lib/content-strategy/types";
import type { ContentStyle, ContentType, ProductHighlight, UsageScene } from "@/types/content";

export type CampaignContentStyle = {
  contentType: ContentType;
  otherRequirements: string;
};

export type BrandReferencePost = {
  id: string;
  title: string;
  characteristics: string[];
  usefulFor: string[];
  contentAngles: string[];
  doNotCopy: string[];
};

export type BrandContext = {
  story: string;
  personality: string[];
  signature: string[];
  approvedFacts: string[];
  toneOfVoice: string[];
  avoid: string[];
  contentAngles: string[];
  referencePosts: BrandReferencePost[];
};

export type Campaign = {
  id: string;
  campaignName: string;
  brandName: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  sellingPoints: ProductHighlight[];
  customQuestion: string;
  usageScenes: UsageScene[];
  contentTypes: ContentType[];
  contentStyles: ContentStyle[];
  targetAudience: string[];
  heroImage: string;
  contentStyle: CampaignContentStyle;
  brandContext?: BrandContext;
  contentStrategy?: ContentStrategyLibrary;
};
