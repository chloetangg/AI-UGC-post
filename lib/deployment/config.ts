export type DeploymentLocationId = "centralworld" | "siam";

export type DeploymentConfig = {
  deploymentId: string;
  brandId: string;
  branchId: string;
  campaignId: string;
  brandName: string;
  branchName: string;
  locationId: DeploymentLocationId;
  /** Old campaign ids that still open this deployment. They do not select another branch. */
  legacyCampaignIds: readonly string[];
  features: {
    xiaohongshu: boolean;
    dianping: boolean;
    coverGeneration: boolean;
  };
};

/**
 * Source presets. A running app loads exactly one, from DEPLOYMENT_ID.
 * Adding a client means a new deployment with its own env and database, not a second preset inside this process.
 */
export const DEPLOYMENT_PRESETS = {
  "baan-ying-centralworld": {
    deploymentId: "baan-ying-centralworld",
    brandId: "baan-ying",
    branchId: "baan-ying-centralworld",
    campaignId: "baan-ying-centralworld",
    brandName: "Baan Ying",
    branchName: "centralwOrld",
    locationId: "centralworld",
    legacyCampaignIds: ["baan-ying"],
    features: { xiaohongshu: true, dianping: true, coverGeneration: true },
  },
  "baan-ying-siam-center": {
    deploymentId: "baan-ying-siam-center",
    brandId: "baan-ying",
    branchId: "baan-ying-siam-center",
    campaignId: "baan-ying-siam-center",
    brandName: "Baan Ying",
    branchName: "Siam Center",
    locationId: "siam",
    legacyCampaignIds: [],
    features: { xiaohongshu: true, dianping: true, coverGeneration: true },
  },
} as const satisfies Record<string, DeploymentConfig>;

export class DeploymentMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentMismatchError";
  }
}

function deploymentIdFromEnv() {
  return (
    process.env.NEXT_PUBLIC_DEPLOYMENT_ID?.trim() ||
    process.env.DEPLOYMENT_ID?.trim() ||
    "baan-ying-centralworld"
  );
}

export function getDeploymentConfig(): DeploymentConfig {
  const id = deploymentIdFromEnv();
  const preset = DEPLOYMENT_PRESETS[id as keyof typeof DEPLOYMENT_PRESETS];
  if (!preset) {
    throw new DeploymentMismatchError(`Unknown deployment ${id}`);
  }
  return preset;
}

export function isCurrentDeploymentRef(id: string) {
  const value = id.trim();
  if (!value) return false;
  const deployment = getDeploymentConfig();
  return (
    value === deployment.deploymentId ||
    value === deployment.campaignId ||
    value === deployment.branchId ||
    deployment.legacyCampaignIds.includes(value)
  );
}

export function assertCurrentDeploymentRequest(input: {
  campaignId?: string;
  brandId?: string;
  branchId?: string;
}) {
  const deployment = getDeploymentConfig();
  if (input.brandId?.trim() && input.brandId.trim() !== deployment.brandId) {
    throw new DeploymentMismatchError(
      `Deployment ${deployment.deploymentId} cannot use brand ${input.brandId.trim()}`,
    );
  }
  const foreign = [input.campaignId, input.branchId].find((id) => id?.trim() && !isCurrentDeploymentRef(id));
  if (foreign) {
    throw new DeploymentMismatchError(
      `Deployment ${deployment.deploymentId} cannot use ${foreign.trim()}`,
    );
  }
  return deployment;
}

/** A stored generation is visible only when it belongs to this deployment. */
export function generationVisibleInDeployment(record: { campaignId?: string; branchId?: string }) {
  const campaignId = record.campaignId?.trim() || "";
  const branchId = record.branchId?.trim() || "";
  if (!campaignId && !branchId) return false;
  return (!campaignId || isCurrentDeploymentRef(campaignId)) && (!branchId || isCurrentDeploymentRef(branchId));
}
