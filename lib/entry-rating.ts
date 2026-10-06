let passedCampaignId = "";

/** Survives in-app navigation, resets on a full page refresh. */
export function markEntryRatingPassed(campaignId: string) {
  passedCampaignId = campaignId;
}

export function hasEntryRatingPassed(campaignId: string) {
  return passedCampaignId === campaignId;
}
