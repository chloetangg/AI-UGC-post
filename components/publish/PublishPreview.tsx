"use client";

import { CopyButton } from "@/components/publish/CopyButton";
import { PostSlideshow } from "@/components/result/PostSlideshow";
import { useT } from "@/components/providers/language-provider";
import type { FinalSlide } from "@/lib/cover/post-layout";
import type { ResultDraft } from "@/types/content";

export function PublishPreview({
  title,
  draft,
  slides,
}: {
  title: string;
  draft: ResultDraft;
  slides: FinalSlide[];
}) {
  const t = useT();

  return (
    <div className="space-y-4">
      {slides.length > 0 ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t.publish.coverLabel}
            </h2>
            {slides[0] ? (
              <a
                href={slides[0].src}
                download="xiaohongshu-cover.png"
                className="text-xs font-semibold text-primary"
              >
                {t.publish.copyCover}
              </a>
            ) : null}
          </div>
          <PostSlideshow
            slides={slides}
            resetKey={slides.map((slide) => `${slide.id}:${slide.src}`).join("|")}
          />
        </section>
      ) : null}
      <PreviewBlock label={t.publish.titleLabel} copyLabel={t.publish.copyTitle} value={title} />
      <PreviewBlock label={t.publish.captionLabel} copyLabel={t.publish.copyCaption} value={draft.caption} />
      <PreviewBlock
        label={t.publish.hashtagsLabel}
        copyLabel={t.publish.copyHashtags}
        value={draft.hashtags.join(" ")}
      />
    </div>
  );
}

function PreviewBlock({
  label,
  copyLabel,
  value,
}: {
  label: string;
  copyLabel: string;
  value: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </h2>
        <CopyButton label={copyLabel} value={value} />
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{value}</p>
    </section>
  );
}
