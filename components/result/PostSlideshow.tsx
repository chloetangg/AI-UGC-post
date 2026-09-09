"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";
import type { FinalSlide } from "@/lib/cover/post-layout";

export function PostSlideshow({
  slides,
  resetKey,
}: {
  slides: FinalSlide[];
  resetKey?: string;
}) {
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [resetKey, slides.length]);

  function handleScroll() {
    const node = scrollerRef.current;
    if (!node || !slides.length) return;
    const width = node.clientWidth || 1;
    setActiveIndex(Math.round(node.scrollLeft / width));
  }

  function goTo(index: number) {
    const node = scrollerRef.current;
    if (!node || !slides.length) return;
    const next = Math.max(0, Math.min(index, slides.length - 1));
    node.scrollTo({ left: next * node.clientWidth, behavior: "smooth" });
    setActiveIndex(next);
  }

  if (slides.length === 0) return null;

  return (
    <div className="relative">
      {slides.length > 1 ? (
        <p className="mb-2 text-right text-sm text-muted-foreground">
          {interpolate(t.result.slideCount, {
            current: String(activeIndex + 1),
            total: String(slides.length),
          })}
        </p>
      ) : null}

      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="min-w-full shrink-0 basis-full snap-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt=""
                className="aspect-[4/5] w-full object-cover"
              />
              {slides.length > 1 ? (
                <span className="sr-only">
                  {slide.kind === "cover"
                    ? t.result.coverLabel
                    : interpolate(t.result.photoSlide, { index: String(index + 1) })}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              aria-label={t.result.prevSlide}
              disabled={activeIndex <= 0}
              onClick={() => goTo(activeIndex - 1)}
              className="absolute top-1/2 left-2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-sm disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t.result.nextSlide}
              disabled={activeIndex >= slides.length - 1}
              onClick={() => goTo(activeIndex + 1)}
              className="absolute top-1/2 right-2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-sm disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={interpolate(t.result.photoSlide, { index: String(index + 1) })}
              onClick={() => goTo(index)}
              className={
                index === activeIndex
                  ? "h-1.5 w-5 rounded-full bg-primary"
                  : "h-1.5 w-1.5 rounded-full bg-border"
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
