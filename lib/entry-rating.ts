import { createId } from "@/lib/id";

let passedCampaignId = "";
/** Used when sessionStorage is blocked, so one visit still keeps one review id. */
const memoryReviewIds = new Map<string, string>();

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

function reviewKey(campaignId: string) {
  return `ugc-entry-review:${campaignId}`;
}

/** This rating round's id, or "" before the first Continue. Generate events carry it to join the round. */
export function currentReviewId(campaignId: string) {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.sessionStorage.getItem(reviewKey(campaignId));
    if (stored) return stored;
  } catch {
    /* Fall back to memory when storage is blocked. */
  }
  return memoryReviewIds.get(campaignId) ?? "";
}

/** One review per round: every retry of the round sends this same id, so the unique eventId index drops repeats. */
export function ensureReviewId(campaignId: string) {
  const existing = currentReviewId(campaignId);
  if (existing) return existing;
  const id = createId();
  memoryReviewIds.set(campaignId, id);
  try {
    window.sessionStorage.setItem(reviewKey(campaignId), id);
  } catch {
    /* The memory copy keeps this visit on one id. */
  }
  return id;
}

export function clearReviewId(campaignId: string) {
  memoryReviewIds.delete(campaignId);
  try {
    window.sessionStorage.removeItem(reviewKey(campaignId));
  } catch {
    /* The page still works if storage is blocked. */
  }
}
