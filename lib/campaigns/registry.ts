import { getDeploymentConfig, isCurrentDeploymentRef } from "@/lib/deployment/config";
import {
  BAAN_YING_CENTRALWORLD,
  BAAN_YING_SIAM_CENTER,
  getBranch,
  getBranchBySurvey,
  listBranches,
} from "@/lib/branches/registry";
import type { BranchConfig } from "@/lib/branches/types";

/** Template id for the original centralwOrld deployment. Runtime campaign id comes from getDeploymentConfig(). */
export const DEFAULT_CAMPAIGN_ID = BAAN_YING_CENTRALWORLD.id;
export const LEGACY_CAMPAIGN_ID = "baan-ying";

export type CampaignRecord = {
  id: string;
  brandId: string;
  branchId: string;
  /** Old /c/baan-ying links keep working on the centralwOrld deployment. */
  legacy?: boolean;
};

const CAMPAIGNS: Record<string, CampaignRecord> = {
  [BAAN_YING_CENTRALWORLD.id]: {
    id: BAAN_YING_CENTRALWORLD.id,
    brandId: BAAN_YING_CENTRALWORLD.brandId,
    branchId: BAAN_YING_CENTRALWORLD.id,
  },
  [BAAN_YING_SIAM_CENTER.id]: {
    id: BAAN_YING_SIAM_CENTER.id,
    brandId: BAAN_YING_SIAM_CENTER.brandId,
    branchId: BAAN_YING_SIAM_CENTER.id,
  },
  [LEGACY_CAMPAIGN_ID]: {
    id: LEGACY_CAMPAIGN_ID,
    brandId: BAAN_YING_CENTRALWORLD.brandId,
    branchId: BAAN_YING_CENTRALWORLD.id,
    legacy: true,
  },
};

export function getCampaignRecord(campaignId: string) {
  const id = campaignId.trim();
  if (!isCurrentDeploymentRef(id)) return null;
  const deployment = getDeploymentConfig();
  const record = CAMPAIGNS[id];
  if (!record) return null;
  return {
    ...record,
    id: record.legacy ? record.id : deployment.campaignId,
    brandId: deployment.brandId,
    branchId: deployment.branchId,
  };
}

export function listCampaigns() {
  return Object.values(CAMPAIGNS).filter((campaign) => !campaign.legacy);
}

/** One clear branch, or null when the words could be more than one branch. */
export function resolveBranchMention(text: string): BranchConfig | null {
  const value = text.trim();
  if (!value) return null;
  const byId = getBranch(value);
  if (byId) return byId;
  const campaign = getCampaignRecord(value);
  if (campaign) return getBranch(campaign.branchId);
  const survey = getBranchBySurvey(value);
  if (survey) return survey;

  const lowered = value.toLowerCase();
  const hits = listBranches().filter((branch) => {
    if (branch.mallPattern.test(value)) return true;
    if (lowered.includes(branch.id)) return true;
    if (branch.locationId === "centralworld" && /central\s*world|尚泰世界/.test(lowered)) return true;
    if (branch.locationId === "siam" && /siam/.test(lowered)) return true;
    return false;
  });
  return hits.length === 1 ? hits[0] : null;
}
