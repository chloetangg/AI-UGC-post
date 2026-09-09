"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { CopyButton } from "@/components/publish/CopyButton";
import { PostSlideshow } from "@/components/result/PostSlideshow";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { interpolate, type Dictionary } from "@/lib/i18n";
import type { FinalSlide } from "@/lib/cover/post-layout";
import {
  collectRednoteDownloads,
  copyRednoteText,
  formatRednotePasteText,
  isMobileDevice,
  openRednotePublish,
  saveRednoteImage,
  saveRednoteImages,
  type PublishStatus,
  type RednotePublishPackage,
  type SaveImagesResult,
} from "@/lib/rednote-publish";
import { cn } from "@/lib/utils";

export function PublishAssistant({
  pkg,
  slides,
}: {
  pkg: RednotePublishPackage;
  slides: FinalSlide[];
}) {
  const t = useT();
  const mobile = useSyncExternalStore(emptySubscribe, isMobileDevice, () => false);
  const pasteText = useMemo(() => formatRednotePasteText(pkg), [pkg]);
  const downloads = useMemo(() => collectRednoteDownloads(pkg), [pkg]);
  const hashtagsLine = pkg.hashtags.join(" ");

  const [status, setStatus] = useState<PublishStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveHint, setSaveHint] = useState<"share" | "long-press" | "cancelled" | "">("");
  const [showAlbumGuide, setShowAlbumGuide] = useState(false);

  const heading = status === "idle" || status === "preparing" ? t.publish.title : t.publish.titleReady;
  const subtitle = statusMessage(status, openFailed, t);

  async function copyAll() {
    const ok = await copyRednoteText(pasteText);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) setStatus((current) => (current === "idle" ? "copied" : current));
    if (!ok) setShowPaste(true);
    return ok;
  }

  async function publishToRednote() {
    if (busy) return;
    setBusy(true);
    setOpenFailed(false);
    setStatus("preparing");
    await copyAll();
    setStatus("opening-rednote");
    const result = await openRednotePublish();
    if (result === "opened") {
      setStatus("completed");
      setShowPaste(true);
    } else {
      setOpenFailed(true);
      setStatus("fallback");
      setShowPaste(true);
    }
    setBusy(false);
  }

  async function handleSaveResult(result: SaveImagesResult) {
    if (result === "shared") {
      setSaveHint("share");
      setShowAlbumGuide(false);
      return;
    }
    if (result === "cancelled") {
      setSaveHint("cancelled");
      return;
    }
    if (result === "long-press") {
      setSaveHint("long-press");
      setShowAlbumGuide(true);
      return;
    }
    setSaveHint("");
  }

  async function saveAll() {
    const result = await saveRednoteImages(pkg);
    await handleSaveResult(result);
  }

  async function saveOne(url: string, fileName: string) {
    const result = await saveRednoteImage(url, fileName);
    await handleSaveResult(result);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 pb-4">
      <div className="space-y-2">
        <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground">
          {heading}
        </h1>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
          {status === "idle" ? t.publish.subtitle : subtitle}
        </p>
      </div>

      {!mobile ? (
        <div className="rounded-3xl bg-accent/70 p-4 text-sm leading-relaxed whitespace-pre-wrap text-accent-foreground">
          {t.publish.desktopHint}
        </div>
      ) : null}

      {slides.length > 0 ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t.publish.coverLabel}
            </h2>
            {pkg.coverImageUrl ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => saveOne(pkg.coverImageUrl, "baan-ying-cover.png")}
              >
                {t.publish.copyCover}
              </button>
            ) : null}
          </div>
          <PostSlideshow
            slides={slides}
            resetKey={slides.map((slide) => `${slide.id}:${slide.src}`).join("|")}
          />
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <ul className="space-y-2.5">
          <CheckRow done={Boolean(pkg.title)} label={t.publish.checkTitle} />
          <CheckRow done={Boolean(pkg.caption)} label={t.publish.checkCaption} />
          <CheckRow
            done={pkg.hashtags.length > 0}
            label={interpolate(t.publish.checkHashtags, { count: pkg.hashtags.length })}
          />
          <CheckRow
            done={Boolean(pkg.coverImageUrl) || pkg.photos.length > 0}
            label={t.publish.checkPhotos}
          />
        </ul>
      </section>

      {status !== "idle" ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <ul className="space-y-2.5 text-sm">
            <li className={copied ? "text-foreground" : "text-muted-foreground"}>
              {copied ? t.publish.stepCopied : t.publish.stepCopyPending}
            </li>
            <li className="text-foreground">{t.publish.stepPhotos}</li>
            <li className="text-foreground">
              {status === "opening-rednote" || status === "completed"
                ? t.publish.stepOpening
                : t.publish.stepOpen}
            </li>
          </ul>
        </section>
      ) : null}

      {copyFailed || showPaste ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          {copyFailed ? (
            <p className="mb-3 text-sm text-destructive">{t.publish.statusCopyFailed}</p>
          ) : null}
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground select-text">
            {pasteText}
          </p>
        </section>
      ) : null}

      {status === "fallback" ? (
        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {t.publish.statusAppMissing}
        </p>
      ) : null}

      <div className="space-y-2">
        {mobile ? (
          <Button className="w-full" variant="outline" onClick={copyAll}>
            {t.publish.copyAll}
          </Button>
        ) : null}
        <Button className="w-full" variant="outline" onClick={saveAll}>
          {t.publish.saveAll}
        </Button>
        {mobile ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.saveShareHint}</p>
        ) : null}
        {saveHint === "cancelled" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.saveCancelled}</p>
        ) : null}
        {saveHint === "long-press" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.longPressHint}</p>
        ) : null}
      </div>

      {status === "fallback" || status === "completed" ? (
        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p>{t.publish.fallbackHint}</p>
          {status === "fallback" ? <p>{t.publish.manualPublish}</p> : null}
        </div>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-semibold text-muted-foreground"
        onClick={() => setShowMore((open) => !open)}
      >
        {t.publish.moreActions}
        {showMore ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {showMore ? (
        <div className="space-y-3">
          <PreviewBlock label={t.publish.titleLabel} copyLabel={t.publish.copyTitle} value={pkg.title} />
          <PreviewBlock label={t.publish.captionLabel} copyLabel={t.publish.copyCaption} value={pkg.caption} />
          <PreviewBlock
            label={t.publish.hashtagsLabel}
            copyLabel={t.publish.copyHashtags}
            value={hashtagsLine}
          />
          <div className="flex flex-wrap gap-2">
            {downloads.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveOne(item.url, item.fileName)}
              >
                {item.kind === "cover"
                  ? t.publish.copyCover
                  : interpolate(t.publish.savePhoto, { index: item.labelIndex })}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {showAlbumGuide ? (
        <section className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.longPressHint}</p>
          <div className="grid grid-cols-2 gap-2">
            {downloads.map((item) => (
              <img
                key={item.key}
                src={item.url}
                alt={item.fileName}
                className="aspect-[4/5] w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.photoNote}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.rednoteLimit}</p>
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 mt-auto bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {mobile ? (
          <Button className="w-full" disabled={busy} onClick={publishToRednote}>
            {t.publish.primaryCta}
          </Button>
        ) : (
          <Button className="w-full" onClick={copyAll}>
            {t.publish.copyAll}
          </Button>
        )}
      </div>
    </div>
  );
}

function emptySubscribe() {
  return () => undefined;
}

function statusMessage(
  status: PublishStatus,
  openFailed: boolean,
  t: Dictionary,
) {
  if (status === "preparing") return t.publish.statusPreparing;
  if (status === "ready" || status === "copied") return t.publish.statusReady;
  if (status === "opening-rednote") return t.publish.statusOpening;
  if (status === "completed") return t.publish.statusOpened;
  if (status === "fallback") {
    return openFailed ? t.publish.statusDeepLinkBlocked : t.publish.statusFallback;
  }
  return t.publish.subtitle;
}

function CheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
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
