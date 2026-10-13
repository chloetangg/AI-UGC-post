"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { useLanguage, useT } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackAnalyticsEvent } from "@/lib/analytics/track-client";
import { RATING_FEEDBACK_MAX_LENGTH } from "@/lib/analytics/types";
import { markEntryRatingPassed, NEW_RATING_PARAM } from "@/lib/entry-rating";
import { campaignPath } from "@/lib/flow";
import { createId } from "@/lib/id";
import { interpolate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;
const BUTTON_CLASS = "w-full";
/** Chinese and Thai glyphs read larger than the Latin serif, so they get a smaller size to stay on one line. */
const HEADING_SIZE_CLASS = {
  en: "text-[clamp(2.25rem,10.5vw,2.625rem)] leading-[1.05]",
  zh: "text-[clamp(1.75rem,8.4vw,2.125rem)] leading-tight",
  th: "text-[clamp(1.75rem,8.4vw,2.125rem)] leading-tight",
} as const;

/** Survives client navigation, resets on a full page load. */
let thankYouInThisVisit = false;
/** Used when sessionStorage is blocked, so one visit still keeps one review id. */
const memoryReviewIds = new Map<string, string>();
/** Step-1 stars kept across in-app navigation (Back); a browser refresh starts empty. */
const stepOneRatings = new Map<string, number>();

function storageKey(campaignId: string) {
  return `ugc-entry-rating:${campaignId}`;
}

function reviewKey(campaignId: string) {
  return `ugc-entry-review:${campaignId}`;
}

function submittedKey(campaignId: string) {
  return `ugc-entry-review-submitted:${campaignId}`;
}

function readStorage(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* The page still works if storage is blocked. */
  }
}

function removeStorage(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* The page still works if storage is blocked. */
  }
}

function readRating(campaignId: string) {
  const value = Number(readStorage(storageKey(campaignId)));
  return value >= 1 && value <= 5 ? value : null;
}

/** One review per visit: the same id is sent on every retry, so the unique eventId index drops repeats. */
function reviewId(campaignId: string) {
  const existing = readStorage(reviewKey(campaignId)) || memoryReviewIds.get(campaignId) || "";
  if (existing) return existing;
  const id = createId();
  memoryReviewIds.set(campaignId, id);
  writeStorage(reviewKey(campaignId), id);
  return id;
}

/** Ends the current round: only this flow's keys, never the rest of sessionStorage. */
function resetRatingFlow(campaignId: string) {
  removeStorage(storageKey(campaignId));
  removeStorage(reviewKey(campaignId));
  removeStorage(submittedKey(campaignId));
  memoryReviewIds.delete(campaignId);
  stepOneRatings.delete(campaignId);
  thankYouInThisVisit = false;
}

/** Records this round's rating once; retries reuse the same eventId, so the unique index drops repeats. */
async function submitRating(campaignId: string, rating: number, note: string) {
  const low = isLowRating(rating);
  const eventId = `rating_submitted:${reviewId(campaignId)}`;
  if (readStorage(submittedKey(campaignId)) !== eventId) {
    await trackAnalyticsEvent({
      eventType: "rating_submitted",
      eventId,
      metadata: {
        rating: String(rating),
        band: low ? "rating_low" : "rating_positive",
        campaignId,
        ...(note ? { feedback: note } : {}),
      },
    });
    writeStorage(submittedKey(campaignId), eventId);
  }
  writeStorage(storageKey(campaignId), String(rating));
}

/** Drops round-specific params so a later refresh resumes this round instead of starting another. */
function replaceWithFreshStarsUrl() {
  const params = new URLSearchParams(window.location.search);
  for (const key of [NEW_RATING_PARAM, "stars", "draw"]) params.delete(key);
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

function isLowRating(rating: number) {
  return rating <= 2;
}

function RatingLayout({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6">
      {children}
      <div className="mt-10">{footer}</div>
    </div>
  );
}

function StoreLine({
  brandName,
  storeName,
  className = "mt-1.5 text-sm",
}: {
  brandName: string;
  storeName: string;
  className?: string;
}) {
  const t = useT();
  return (
    <p className={cn("text-center text-muted-foreground", className)}>
      {interpolate(t.rating.storeLine, { brand: brandName, store: storeName })}
    </p>
  );
}

export function RatingPageClient({
  newRound = false,
  initialDraw = false,
  brandName,
  storeName,
}: {
  newRound?: boolean;
  initialDraw?: boolean;
  brandName: string;
  storeName: string;
}) {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { language, t } = useLanguage();
  const onDrawUrl = useSearchParams().get("draw") === "1";
  const [draw, setDraw] = useState(initialDraw);
  const [rating, setRating] = useState<number | null>(() => stepOneRatings.get(campaignId) ?? null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  useLayoutEffect(() => {
    if (!newRound) return;
    resetRatingFlow(campaignId);
    replaceWithFreshStarsUrl();
  }, [campaignId, newRound]);

  useLayoutEffect(() => {
    if (stepOneRatings.has(campaignId)) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("stars")) return;
    params.delete("stars");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [campaignId]);

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("draw") !== "1") return;
    const saved = readRating(campaignId);
    const submitted = thankYouInThisVisit || readStorage(submittedKey(campaignId)) !== "";
    if (submitted && saved != null && isLowRating(saved)) {
      setRating(saved);
      setDraw(true);
      return;
    }
    setDraw(false);
    setRating(null);
    params.delete("draw");
    const query = params.toString();
    router.replace(query ? `/c/${campaignId}/rating?${query}` : `/c/${campaignId}/rating`);
  }, [campaignId, router]);

  function rateAgain() {
    resetRatingFlow(campaignId);
    setDraw(false);
    setRating(null);
    replaceWithFreshStarsUrl();
  }

  function selectRating(next: number) {
    setRating(next);
    stepOneRatings.set(campaignId, next);
    const params = new URLSearchParams(window.location.search);
    params.set("stars", String(next));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  async function continueToReview() {
    if (rating == null || inFlight.current) return;
    if (isLowRating(rating)) {
      writeStorage(storageKey(campaignId), String(rating));
      reviewId(campaignId);
      router.push(`/c/${campaignId}/rating/review?stars=${rating}`);
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    await submitRating(campaignId, rating, "");
    markEntryRatingPassed(campaignId);
    router.push(campaignPath(campaignId, "experience"));
  }

  // Back/forward can restore a cached draw render under a stars URL; only the draw URL shows thanks.
  if (draw && onDrawUrl) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <PageTitle title={t.rating.lowThanks} subtitle={t.rating.showToStaff} centered />
        <Button type="button" className="mt-2 w-full max-w-xs" onClick={rateAgain}>
          {t.rating.rateAgain}
        </Button>
      </div>
    );
  }

  return (
    <RatingLayout
      footer={
        <>
          <Button
            type="button"
            className="mx-auto flex h-11 w-full max-w-[17.5rem]"
            disabled={rating == null || submitting}
            onClick={continueToReview}
          >
            {t.rating.continueToReview}
          </Button>
          <p className="mt-2.5 h-4 text-center text-xs text-muted-foreground" aria-live="polite">
            {rating == null ? t.rating.selectFirst : null}
          </p>
        </>
      }
    >
      <h1
        className={cn(
          "text-balance text-center font-display tracking-tight text-primary",
          HEADING_SIZE_CLASS[language],
        )}
      >
        {t.rating.heading}
      </h1>
      <StoreLine
        brandName={brandName}
        storeName={storeName}
        className="mt-2.5 text-[clamp(1.25rem,5.8vw,1.5rem)] leading-snug"
      />
      <div
        role="radiogroup"
        aria-label={t.rating.groupLabel}
        className="mt-9 flex items-center justify-center gap-2.5"
      >
        {STARS.map((value) => {
          const selected = rating != null && value <= rating;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={interpolate(t.rating.starLabel, { count: value })}
              onClick={() => selectRating(value)}
              className={cn(
                "flex size-11 items-center justify-center rounded-full transition-colors",
                selected ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border/70",
              )}
            >
              <Star className={cn("size-5", selected && "fill-current")} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
      <p className="mt-3 h-5 text-center text-sm font-medium text-primary" aria-live="polite">
        {rating != null ? t.rating.levels[rating - 1] : null}
      </p>
      <p className="mt-1 text-center text-[13px] text-muted-foreground">{t.rating.scaleHint}</p>
    </RatingLayout>
  );
}

export function RatingReviewClient({
  rating,
  brandName,
  storeName,
}: {
  rating: number;
  brandName: string;
  storeName: string;
}) {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const t = useT();
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const low = isLowRating(rating);

  function goBack() {
    stepOneRatings.set(campaignId, rating);
    router.push(`/c/${campaignId}/rating?stars=${rating}`);
  }

  async function submitReview() {
    const note = low ? feedback.trim() : "";
    if (inFlight.current || (low && !note)) return;
    inFlight.current = true;
    setSubmitting(true);
    await submitRating(campaignId, rating, note);
    if (low) {
      thankYouInThisVisit = true;
      router.push(`/c/${campaignId}/rating?draw=1`);
      return;
    }
    markEntryRatingPassed(campaignId);
    router.push(campaignPath(campaignId, "experience"));
  }

  return (
    <RatingLayout
      footer={
        <div className="space-y-2">
          <Button
            type="button"
            className={BUTTON_CLASS}
            disabled={submitting || (low && !feedback.trim())}
            onClick={submitReview}
          >
            {submitting ? t.rating.submitting : t.rating.submitReview}
          </Button>
          <Button type="button" variant="ghost" className={BUTTON_CLASS} disabled={submitting} onClick={goBack}>
            {t.rating.back}
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-center gap-1.5" aria-label={interpolate(t.rating.starLabel, { count: rating })}>
        {STARS.map((value) => (
          <Star
            key={value}
            aria-hidden
            className={cn("size-5", value <= rating ? "fill-current text-primary" : "text-muted-foreground/50")}
            strokeWidth={1.75}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-sm font-medium text-primary">{t.rating.levels[rating - 1]}</p>
      <h1 className="mt-6 text-center font-display text-2xl leading-tight tracking-tight text-foreground">
        {low ? t.rating.feedbackLabel : t.rating.reviewThanks}
      </h1>
      <StoreLine brandName={brandName} storeName={storeName} />
      {low ? (
        <div className="mt-6">
          <Label htmlFor="rating-feedback" className="sr-only">
            {t.rating.feedbackLabel}
          </Label>
          <Textarea
            id="rating-feedback"
            rows={3}
            required
            value={feedback}
            maxLength={RATING_FEEDBACK_MAX_LENGTH}
            placeholder={t.rating.feedbackPlaceholder}
            onChange={(event) => setFeedback(event.target.value)}
            className="min-h-0 resize-none rounded-[10px] px-3 py-2.5 text-sm shadow-none"
          />
        </div>
      ) : null}
    </RatingLayout>
  );
}
