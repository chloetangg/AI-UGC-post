"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { useT } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/track-client";
import { markEntryRatingPassed } from "@/lib/entry-rating";
import { campaignPath } from "@/lib/flow";
import { interpolate } from "@/lib/i18n";
import { LUCKY_DRAW_URL } from "@/lib/lucky-draw";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

/** Survives client navigation, resets on a full page load. */
let thankYouInThisVisit = false;

function storageKey(campaignId: string) {
  return `ugc-entry-rating:${campaignId}`;
}

function readRating(campaignId: string) {
  try {
    const value = Number(window.sessionStorage.getItem(storageKey(campaignId)));
    return value >= 1 && value <= 5 ? value : null;
  } catch {
    return null;
  }
}

function writeRating(campaignId: string, rating: number) {
  try {
    window.sessionStorage.setItem(storageKey(campaignId), String(rating));
  } catch {
    /* The page still works if storage is blocked. */
  }
}

function isLowRating(rating: number) {
  return rating <= 2;
}

export function RatingPageClient({ initialDraw = false }: { initialDraw?: boolean }) {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const t = useT();
  const [draw, setDraw] = useState(initialDraw);
  const [rating, setRating] = useState<number | null>(null);
  const submittedRating = useRef<number | null>(null);

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("draw") !== "1") return;
    if (thankYouInThisVisit) {
      const saved = readRating(campaignId);
      if (saved != null && isLowRating(saved)) {
        setRating(saved);
        setDraw(true);
      }
      return;
    }
    setDraw(false);
    setRating(null);
    try {
      window.sessionStorage.removeItem(storageKey(campaignId));
    } catch {
      /* The stars page still shows if storage is blocked. */
    }
    params.delete("draw");
    const query = params.toString();
    router.replace(query ? `/c/${campaignId}/rating?${query}` : `/c/${campaignId}/rating`);
  }, [campaignId, router]);

  function trackRating(next: number) {
    if (submittedRating.current === next) return;
    submittedRating.current = next;
    void trackAnalyticsEvent({
      eventType: "rating_submitted",
      metadata: {
        rating: String(next),
        band: isLowRating(next) ? "rating_low" : "rating_positive",
        campaignId,
      },
    });
  }

  function selectRating(next: number) {
    setRating(next);
    writeRating(campaignId, next);
    if (!isLowRating(next)) return;
    trackRating(next);
    thankYouInThisVisit = true;
    setDraw(true);
    router.push(`/c/${campaignId}/rating?draw=1`);
  }

  function continueNext() {
    if (rating == null || isLowRating(rating)) return;
    trackRating(rating);
    markEntryRatingPassed(campaignId);
    router.push(campaignPath(campaignId, "customer"));
  }

  function openLuckyDraw() {
    // TODO: navigate once LUCKY_DRAW_URL is the real campaign link.
    if (!LUCKY_DRAW_URL) return;
    window.location.assign(LUCKY_DRAW_URL);
  }

  if (draw) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <PageTitle title={t.rating.lowThanks} subtitle={t.rating.lowInvite} centered />
        <Button type="button" className="mt-2 w-full max-w-xs" onClick={openLuckyDraw}>
          {t.rating.drawCta}
        </Button>
      </div>
    );
  }

  const showContinue = rating != null && !isLowRating(rating);

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <PageTitle title={t.rating.title} centered />
      <div
        role="radiogroup"
        aria-label={t.rating.groupLabel}
        className="flex items-center justify-center gap-2"
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
                "flex size-14 items-center justify-center rounded-full transition-colors",
                selected ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
              )}
            >
              <Star className={cn("size-7", selected && "fill-current")} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
      {showContinue ? (
        <Button type="button" className="mt-8 w-full max-w-xs" onClick={continueNext}>
          {t.rating.positiveContinue}
        </Button>
      ) : null}
    </div>
  );
}
