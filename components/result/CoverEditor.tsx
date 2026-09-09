"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { PostSlideshow } from "@/components/result/PostSlideshow";
import type { FinalSlide } from "@/lib/cover/post-layout";
import type { CoverState } from "@/types/content";

export function CoverEditor({
  cover,
  slides,
  composing,
  onRetry,
}: {
  cover: CoverState;
  slides: FinalSlide[];
  composing: boolean;
  onRetry: () => void;
}) {
  const t = useT();

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{t.result.coverLabel}</h2>

      <div className="relative">
        {slides.length > 0 ? (
          <PostSlideshow
            slides={slides}
            resetKey={`${cover.generatedCoverImageUrl ?? ""}:${slides.map((slide) => slide.id).join("|")}`}
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center rounded-3xl border border-border bg-muted px-6 text-center text-sm text-muted-foreground">
            {cover.error ? t.result.coverError : t.result.coverPreparing}
          </div>
        )}
        {composing ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/70 text-sm font-medium">
            {t.generating.cover}
          </div>
        ) : null}
      </div>

      {cover.error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{t.result.coverError}</p>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={composing}>
            {t.result.retryCover}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
