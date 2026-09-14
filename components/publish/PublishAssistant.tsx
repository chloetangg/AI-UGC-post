"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { CopyButton } from "@/components/publish/CopyButton";
import { DianpingManualPublish } from "@/components/publish/DianpingManualPublish";
import { PostSlideshow } from "@/components/result/PostSlideshow";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { interpolate, type Dictionary } from "@/lib/i18n";
import type { FinalSlide } from "@/lib/cover/post-layout";
import {
  canShareFiles,
  collectRednoteDownloads,
  copyPublishText,
  formatRednotePasteText,
  isMobileDevice,
  openRednotePublish,
  type PublishStatus,
  type RednotePublishPackage,
} from "@/lib/rednote-publish";
import { downloadGeneratedImage, sharePost } from "@/lib/publish/share";
import type { PublishPlatform } from "@/lib/publish/types";
import { trackAnalyticsEvent } from "@/lib/analytics/track-client";
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
  const fileShare = useSyncExternalStore(emptySubscribe, canShareFiles, () => false);
  const pasteText = useMemo(() => formatRednotePasteText(pkg), [pkg]);
  const downloads = useMemo(() => collectRednoteDownloads(pkg), [pkg]);
  const hashtagsLine = pkg.hashtags.join(" ");

  const [screen, setScreen] = useState<"home" | "choose" | "dianping">("home");
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [copyFailed, setCopyFailed] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filesPartial, setFilesPartial] = useState(false);
  const [saving, setSaving] = useState(false);

  const showSaveImages = !mobile || status === "fallback" || status === "files-partial";
  const showNativeHints = status === "shared";

  async function copyAll() {
    const ok = await copyPublishText(pasteText);
    setCopyFailed(!ok);
    if (ok) {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
      setStatus((current) => (current === "idle" ? "copied" : current));
      return true;
    }
    setShowPaste(true);
    return false;
  }

  function trackPlatformSelected(platform: PublishPlatform) {
    trackAnalyticsEvent({
      eventType: "publish_platform_selected",
      metadata: {
        platform,
        source: "share_page",
      },
    });
  }

  function trackWebShare() {
    trackAnalyticsEvent({
      eventType: "publish_click",
      metadata: {
        platform: "unknown",
        method: "web_share",
        source: "share_page",
      },
    });
  }

  function trackRednoteDeepLink() {
    trackAnalyticsEvent({
      eventType: "publish_click",
      metadata: {
        platform: "xiaohongshu",
        method: "deep_link",
        source: "share_page",
      },
    });
  }

  async function handleXiaohongshu() {
    if (busy) return;
    trackPlatformSelected("xiaohongshu");
    setBusy(true);
    setOpenFailed(false);
    setFilesPartial(false);
    setStatus("preparing");

    try {
      const published = await sharePost(pkg);
      setFilesPartial(published.filesPartial);

      if (published.outcome === "shared") {
        trackWebShare();
        setStatus("shared");
      } else if (published.outcome === "cancelled") {
        setStatus("cancelled");
      } else if (published.outcome === "desktop") {
        setStatus("idle");
      } else if (published.filesPartial) {
        setStatus("files-partial");
      } else {
        setStatus("fallback");
      }
    } catch (error) {
      console.error("Publish preparation failed", error);
      setFilesPartial(true);
      setStatus("files-partial");
    }
    setBusy(false);
  }

  function handleDianping() {
    trackPlatformSelected("dianping");
    setScreen("dianping");
  }

  async function saveImages() {
    if (saving) return;
    setSaving(true);
    await downloadGeneratedImage(pkg);
    setSaving(false);
  }

  async function openRednote() {
    if (!mobile) return;
    setBusy(true);
    const opened = await openRednotePublish();
    if (opened === "opened") {
      trackRednoteDeepLink();
      setOpenFailed(false);
      setStatus("completed");
    } else {
      setOpenFailed(true);
      setStatus("fallback");
    }
    setBusy(false);
  }

  if (screen === "dianping") {
    return <DianpingManualPublish pkg={pkg} onBack={() => setScreen("choose")} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 pb-4">
      <div className="space-y-2">
        <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground">
          {screen === "choose" ? t.publish.choosePlatform : t.publish.title}
        </h1>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
          {screen === "choose"
            ? t.publish.subtitle
            : status === "idle"
              ? t.publish.subtitle
              : statusMessage(status, openFailed, t)}
        </p>
      </div>

      {!mobile ? (
        <div className="rounded-3xl bg-accent/70 p-4 text-sm leading-relaxed whitespace-pre-wrap text-accent-foreground">
          {t.publish.desktopHint}
        </div>
      ) : null}

      {slides.length > 0 ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t.publish.coverLabel}
          </h2>
          <PostSlideshow
            slides={slides}
            resetKey={slides.map((slide) => `${slide.id}:${slide.src}`).join("|")}
          />
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <ul className="space-y-2.5">
          <CheckRow done={Boolean(pkg.coverImageUrl)} label={t.publish.checkCover} />
          <CheckRow
            done={downloads.length > 0}
            label={interpolate(t.publish.checkImageCount, { count: downloads.length })}
          />
        </ul>
      </section>

      {screen === "choose" ? (
        <section className="space-y-3">
          <Button className="h-auto w-full flex-col items-start gap-1 px-5 py-4" disabled={busy} onClick={() => void handleXiaohongshu()}>
            <span className="text-base">{t.publish.platforms.xiaohongshu}</span>
            <span className="text-sm font-normal text-primary-foreground/80">{t.publish.dianpingGuide.chooseXhs}</span>
          </Button>
          <Button
            className="h-auto w-full flex-col items-start gap-1 px-5 py-4"
            variant="outline"
            disabled={busy}
            onClick={handleDianping}
          >
            <span className="text-base">{t.publish.platforms.dianping}</span>
            <span className="text-sm font-normal text-muted-foreground">{t.publish.dianpingGuide.chooseDp}</span>
          </Button>
        </section>
      ) : null}

      {status === "shared" && fileShare ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <ul className="space-y-2.5 text-sm">
            <li className="text-foreground">{t.publish.stepPhotos}</li>
            <li className="text-foreground">{t.publish.stepShare}</li>
          </ul>
        </section>
      ) : null}

      {showNativeHints ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {t.publish.statusAppMissing}
        </p>
      ) : null}
      {filesPartial && status === "shared" ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {t.publish.statusFilesPartial}
        </p>
      ) : null}

      {copyFailed || showPaste ? (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          {copyFailed ? (
            <p className="mb-3 text-sm text-destructive">{t.publish.statusCopyFailed}</p>
          ) : null}
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t.publish.captionLabel}
            </h2>
            <CopyButton label={t.publish.copyAll} value={pasteText} />
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground select-text">
            {pasteText}
          </p>
        </section>
      ) : null}

      {screen === "home" ? (
        <Button className="w-full" variant="outline" onClick={() => void copyAll()}>
          {copiedAll ? t.common.copied : t.publish.copyAll}
        </Button>
      ) : null}
      {screen === "home" && showSaveImages ? (
        <Button className="w-full" variant="outline" disabled={saving} onClick={() => void saveImages()}>
          {t.publish.saveImage}
        </Button>
      ) : null}
      {mobile && screen !== "choose" && (status === "fallback" || status === "files-partial") ? (
        <Button className="w-full" variant="outline" disabled={busy} onClick={() => void openRednote()}>
          {t.publish.openXiaohongshu}
        </Button>
      ) : null}

      {screen === "home" ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-1 pt-1 text-xs font-semibold text-muted-foreground"
          onClick={() => setShowMore((open) => !open)}
        >
          {t.publish.moreActions}
          {showMore ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      ) : null}

      {screen === "home" && showMore ? (
        <div className="space-y-3">
          <PreviewBlock label={t.publish.titleLabel} copyLabel={t.publish.copyTitle} value={pkg.title} />
          <PreviewBlock label={t.publish.captionLabel} copyLabel={t.publish.copyCaption} value={pkg.caption} />
          <PreviewBlock
            label={t.publish.hashtagsLabel}
            copyLabel={t.publish.copyHashtags}
            value={hashtagsLine}
          />
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.photoNote}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.rednoteLimit}</p>
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 mt-auto bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {screen === "home" ? (
          <Button className="w-full" disabled={busy} onClick={() => setScreen("choose")}>
            {t.publish.primaryCta}
          </Button>
        ) : (
          <Button className="w-full" variant="outline" disabled={busy} onClick={() => setScreen("home")}>
            {t.publish.closeSelector}
          </Button>
        )}
      </div>
    </div>
  );
}

function emptySubscribe() {
  return () => undefined;
}

function statusMessage(status: PublishStatus, openFailed: boolean, t: Dictionary) {
  if (status === "preparing" || status === "sharing") return t.publish.statusPreparing;
  if (status === "ready" || status === "copied") return t.publish.statusReady;
  if (status === "cancelled") return t.publish.statusCancelled;
  if (status === "shared") return t.publish.statusShared;
  if (status === "files-partial") return t.publish.statusFilesPartial;
  if (status === "completed") return t.publish.statusOpened;
  if (status === "fallback") {
    if (openFailed) return t.publish.statusDeepLinkBlocked;
    return t.publish.fallbackReady;
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
