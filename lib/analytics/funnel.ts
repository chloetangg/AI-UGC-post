import { getDb } from "@/lib/mongodb";
import { getDeploymentConfig, isCurrentDeploymentRef } from "@/lib/deployment/config";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import {
  ANALYTICS_CAMPAIGN,
  ANALYTICS_COLLECTION,
  FORM_SUBMIT_SOURCE,
  GENERATE_ACTION_TYPES,
  RATING_FEEDBACK_MAX_LENGTH,
  parseStarRating,
  type AnalyticsEventType,
  type GenerateActionType,
} from "@/lib/analytics/types";

export const FUNNEL_EVENT_TYPES = ["rating_submitted", "form_submit", "generate"] as const;
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export type FunnelSession = { sessionId: string; qrCodeId: string };

export type FunnelResult =
  | { ok: true; duplicate: boolean; eventId: string }
  | { ok: false; status: 400 | 409 | 503; error: string };

/** Review, action and generation ids are client UUIDs; anything else is rejected rather than reshaped. */
export function funnelId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,80}$/.test(value.trim()) ? value.trim() : "";
}

export function isFunnelEventType(value: string): value is FunnelEventType {
  return (FUNNEL_EVENT_TYPES as readonly string[]).includes(value);
}

export const ratingSubmittedEventId = (reviewId: string) => `rating_submitted:${reviewId}`;
export const formSubmitEventId = (reviewId: string) => `form_submit:${reviewId}`;
export const generateEventId = (actionId: string) => `generate:${actionId}`;

/** One success per generate action; a request without an action still counts once by its own generation id. */
export function generationCompleteEventId(actionId: string, generationId: string) {
  return `generation_complete:${funnelId(actionId) || generationId}`;
}

function reject(error: string, status: 400 | 409 = 400): FunnelResult {
  return { ok: false, status, error };
}

function field(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Trimmed feedback for 1–2 stars: required, text only, at most RATING_FEEDBACK_MAX_LENGTH, never cut. */
export function lowRatingFeedback(value: unknown): { feedback: string } | { error: string } {
  if (typeof value !== "string") return { error: "Feedback is required for 1–2 stars." };
  const feedback = value.trim();
  if (!feedback) return { error: "Feedback is required for 1–2 stars." };
  if (feedback.length > RATING_FEEDBACK_MAX_LENGTH) {
    return { error: `Feedback must be at most ${RATING_FEEDBACK_MAX_LENGTH} characters.` };
  }
  return { feedback };
}

async function positiveRatingRecorded(reviewId: string) {
  const db = await getDb();
  const rating = await db
    .collection(ANALYTICS_COLLECTION)
    .findOne({ eventId: ratingSubmittedEventId(reviewId) }, { projection: { metadata: 1 } });
  return (rating?.metadata as Record<string, unknown> | undefined)?.band === "rating_positive";
}

async function write(
  eventType: AnalyticsEventType,
  eventId: string,
  session: FunnelSession,
  metadata: Record<string, string>,
): Promise<FunnelResult> {
  const result = await recordAnalyticsEvent({
    eventType,
    eventId,
    sessionId: session.sessionId,
    qrCodeId: session.qrCodeId,
    campaign: ANALYTICS_CAMPAIGN,
    metadata,
  });
  if (result.recorded || result.duplicate) return { ok: true, duplicate: result.duplicate, eventId };
  console.error(`[analytics] ${eventType} was not written to MongoDB (${eventId})`);
  return { ok: false, status: 503, error: "Could not save. Please try again." };
}

/**
 * `rating_submitted`, `form_submit` and `generate` from the browser. The eventId is built here from the
 * review or action id, so a retry of the same round or click hits the unique index instead of a second row.
 */
export async function recordFunnelEvent(
  eventType: FunnelEventType,
  rawMetadata: unknown,
  session: FunnelSession,
): Promise<FunnelResult> {
  const metadata =
    rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : {};
  const deployment = getDeploymentConfig();
  const campaignId = field(metadata, "campaignId");
  if (!campaignId || !isCurrentDeploymentRef(campaignId)) {
    return reject(`This deployment cannot record events for ${campaignId || "an unknown campaign"}.`);
  }
  const base = { campaignId: deployment.campaignId, branchId: deployment.branchId };
  const reviewId = funnelId(metadata.reviewId);

  if (eventType === "rating_submitted") {
    if (!reviewId) return reject("Missing reviewId.");
    const rating = parseStarRating(metadata.rating);
    if (rating == null) return reject("Rating must be a whole number from 1 to 5.");
    const low = rating <= 2;
    const checked = low ? lowRatingFeedback(metadata.feedback) : null;
    if (checked && "error" in checked) return reject(checked.error);
    return write("rating_submitted", ratingSubmittedEventId(reviewId), session, {
      ...base,
      reviewId,
      rating: String(rating),
      band: low ? "rating_low" : "rating_positive",
      ...(checked ? { feedback: checked.feedback } : {}),
    });
  }

  if (eventType === "form_submit") {
    if (!reviewId) return reject("Missing reviewId.");
    try {
      if (!(await positiveRatingRecorded(reviewId))) {
        return reject("form_submit needs a recorded 3–5 star rating for this review.", 409);
      }
    } catch (error) {
      console.error("[analytics] form_submit rating lookup failed");
      const detail = error instanceof Error ? error.message : "";
      if (detail) console.error("[analytics]", detail);
      return { ok: false, status: 503, error: "Could not save. Please try again." };
    }
    return write("form_submit", formSubmitEventId(reviewId), session, {
      ...base,
      reviewId,
      source: FORM_SUBMIT_SOURCE,
    });
  }

  const actionId = funnelId(metadata.actionId);
  if (!actionId) return reject("Missing actionId.");
  const actionType = field(metadata, "actionType") as GenerateActionType;
  if (!GENERATE_ACTION_TYPES.includes(actionType)) {
    return reject(`actionType must be one of ${GENERATE_ACTION_TYPES.join(", ")}.`);
  }
  const previousGenerationId = funnelId(metadata.previousGenerationId);
  return write("generate", generateEventId(actionId), session, {
    ...base,
    reviewId,
    actionId,
    actionType,
    ...(previousGenerationId ? { previousGenerationId } : {}),
  });
}
