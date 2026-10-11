let passedCampaignId = "";

/** Query flag on the stars page that starts a new rating round instead of resuming the current one. */
export const NEW_RATING_PARAM = "new";

export function newRatingPath(campaignId: string) {
  return `/c/${campaignId}/rating?${NEW_RATING_PARAM}=1`;
}

/** Survives in-app navigation, resets on a full page refresh. */
export function markEntryRatingPassed(campaignId: string) {
  passedCampaignId = campaignId;
}

export function hasEntryRatingPassed(campaignId: string) {
  return passedCampaignId === campaignId;
}
