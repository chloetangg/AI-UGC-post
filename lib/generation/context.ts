import { BAAN_YING_BRAND_CONTEXT } from "@/lib/brand/baan-ying-context";
import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { assertBranchConfigIsolation, getBranch } from "@/lib/branches/registry";
import type { BranchConfig } from "@/lib/branches/types";
import { assertCurrentDeploymentRequest, getDeploymentConfig } from "@/lib/deployment/config";
import { OFFICIAL_LOCATIONS, type OfficialLocation } from "@/lib/locations";

export type GenerationContext = {
  brandId: string;
  branchId: string;
  campaignId: string;
  branch: BranchConfig;
  location: OfficialLocation;
  brandContext: typeof BAAN_YING_BRAND_CONTEXT;
  contentStrategy: typeof BAAN_YING_CONTENT_STRATEGY;
};

export function resolveGenerationContext(input: {
  campaignId?: string;
  brandId?: string;
  branchId?: string;
  branch?: string;
} = {}): GenerationContext {
  const deployment = assertCurrentDeploymentRequest(input);
  const branch = getBranch(deployment.branchId);
  if (!branch) {
    throw new Error(`Deployment ${deployment.deploymentId} has no branch`);
  }
  assertBranchConfigIsolation(branch);
  const location = OFFICIAL_LOCATIONS[deployment.locationId];
  return {
    brandId: deployment.brandId,
    branchId: deployment.branchId,
    campaignId: deployment.campaignId,
    branch,
    location,
    brandContext: BAAN_YING_BRAND_CONTEXT,
    contentStrategy: BAAN_YING_CONTENT_STRATEGY,
  };
}
