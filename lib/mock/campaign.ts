import type { Campaign } from "@/types/campaign";
import { BAAN_YING_BRAND_CONTEXT } from "@/lib/brand/baan-ying-context";
import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { getDeploymentConfig } from "@/lib/deployment/config";
import { getBranch } from "@/lib/branches/registry";
import { CONTENT_STYLES, CONTENT_TYPES, PRODUCT_HIGHLIGHTS, USAGE_SCENES } from "@/types/content";

export const MOCK_CAMPAIGN_ID = getDeploymentConfig().campaignId;

const sharedCampaign = {
  brandName: "Baan Ying",
  productName: "Baan Ying",
  productCategory: "Thai Restaurant / Food & Dining",
  productDescription:
    "Discover Baan Ying, a Thai restaurant experience featuring classic Thai flavors in a relaxed and lifestyle-friendly setting.",
  sellingPoints: [...PRODUCT_HIGHLIGHTS],
  customQuestion: "What did you enjoy most about your Baan Ying experience?",
  usageScenes: [...USAGE_SCENES],
  contentTypes: CONTENT_TYPES.map((type) => type.value),
  contentStyles: [...CONTENT_STYLES],
  targetAudience: [
    "Bangkok travelers",
    "Thai food lovers",
    "Foodies",
    "Young adults",
    "Travelers looking for restaurant recommendations",
    "People interested in Bangkok dining",
  ],
  heroImage: "/baan-ying-logo.png",
  contentStyle: {
    contentType: "restaurant-recommendation" as const,
    otherRequirements: "",
  },
  brandContext: BAAN_YING_BRAND_CONTEXT,
  contentStrategy: BAAN_YING_CONTENT_STRATEGY,
};

export function getCampaign(_campaignId?: string): Campaign {
  const deployment = getDeploymentConfig();
  const branch = getBranch(deployment.branchId);
  return {
    ...sharedCampaign,
    id: deployment.campaignId,
    campaignName: branch ? `${deployment.brandName} ${branch.name}` : deployment.brandName,
  };
}
