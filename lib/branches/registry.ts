import { OFFICIAL_LOCATIONS, type OfficialLocation } from "@/lib/locations";
import { CENTRALWORLD_HASHTAGS, GENERIC_HASHTAGS, SIAM_CENTER_HASHTAGS } from "@/lib/branches/hashtag-pools";
import type { BranchConfig } from "@/lib/branches/types";

const BRAND_ID = "baan-ying";

function branchFromLocation(
  id: string,
  location: OfficialLocation,
  mallSpellings: readonly string[],
  mallPattern: RegExp,
  hashtags: readonly string[],
  dianpingShopId: string,
): BranchConfig {
  return {
    id,
    brandId: BRAND_ID,
    name: location.englishName,
    locationId: location.id,
    surveyValue: location.surveyValue,
    mallSpellings,
    mallPattern,
    hashtags,
    dianpingShopId,
  };
}

export const BAAN_YING_CENTRALWORLD = branchFromLocation(
  "baan-ying-centralworld",
  OFFICIAL_LOCATIONS.centralworld,
  ["Centralworld", "centralworld"],
  /central\s*world/i,
  CENTRALWORLD_HASHTAGS,
  "k9fdoJpGAdqK1XGc",
);

export const BAAN_YING_SIAM_CENTER = branchFromLocation(
  "baan-ying-siam-center",
  OFFICIAL_LOCATIONS.siam,
  ["Siam Center"],
  /siam\s*center/i,
  SIAM_CENTER_HASHTAGS,
  "Ga6sQ4S2uv7WJC6i",
);

const BRANCHES: Record<string, BranchConfig> = {
  [BAAN_YING_CENTRALWORLD.id]: BAAN_YING_CENTRALWORLD,
  [BAAN_YING_SIAM_CENTER.id]: BAAN_YING_SIAM_CENTER,
};

export function listBranches() {
  return Object.values(BRANCHES);
}

export function getBranch(branchId: string) {
  return BRANCHES[branchId] ?? null;
}

export function getBranchesByBrand(brandId: string) {
  return listBranches().filter((branch) => branch.brandId === brandId);
}

export function getBranchBySurvey(surveyValue: string) {
  const value = surveyValue.trim().toLowerCase();
  return (
    listBranches().find((branch) => branch.surveyValue.toLowerCase() === value) ??
    listBranches().find((branch) => branch.mallPattern.test(surveyValue)) ??
    null
  );
}

export function hashtagPoolForBranch(branch: BranchConfig) {
  return [...GENERIC_HASHTAGS, ...branch.hashtags];
}

export function assertBranchConfigIsolation(branch: BranchConfig) {
  const own = `${branch.name} ${branch.hashtags.join(" ")}`.toLowerCase();
  for (const other of listBranches()) {
    if (other.id === branch.id) continue;
    if (own.includes(other.name.toLowerCase())) {
      throw new Error(`Branch ${branch.id} includes facts from ${other.id}`);
    }
  }
}
