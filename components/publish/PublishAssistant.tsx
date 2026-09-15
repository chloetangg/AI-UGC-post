"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { CopyButton } from "@/components/publish/CopyButton";
import { DianpingCopyModal } from "@/components/publish/DianpingManualPublish";
import { PostSlideshow } from "@/components/result/PostSlideshow";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
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
import { sharePost } from "@/lib/publish/share";
import { DIANPING_SHOP_WEB_URL } from "@/lib/publish/dianping-shop";
import { openTrackedDianpingShop } from "@/lib/publish/track-dianping";
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
  const { generationId } = useCampaignFlow();
  const mobile = useSyncExternalStore(emptySubscribe, isMobileDevice, () => false);
  const fileShare = useSyncExternalStore(emptySubscribe, canShareFiles, () => false);
  const pasteText = useMemo(() => formatRednotePasteText(pkg), [pkg]);
  const downloads = useMemo(() => collectRednoteDownloads(pkg), [pkg]);

  const [status, setStatus] = useState<PublishStatus>("idle");
  const [dianpingOpen, setDianpingOpen] = useState(false);
  const [dianpingFallback, setDianpingFallback] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filesPartial, setFilesPartial] = useState(false);

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
    if (busy) return;
    trackPlatformSelected("dianping");
    setDianpingFallback(false);
    setDianpingOpen(true);
  }

  async function publishDianping() {
    if (busy) return;
    setBusy(true);
    setDianpingFallback(false);
    const result = await openTrackedDianpingShop(generationId);
    if (result === "fallback" || result === "desktop") setDianpingFallback(true);
    setBusy(false);
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 pb-4">
        <div className="space-y-2">
          <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground">
            {t.publish.choosePlatform}
          </h1>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
            {status === "idle" || status === "copied"
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

        <Button className="w-full" size="lg" variant="outline" onClick={() => void copyAll()}>
          {copiedAll ? t.publish.checkCopied : t.publish.copyAll}
        </Button>

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

        <section className="space-y-3">
          <PlatformCard
            name={t.publish.platforms.xiaohongshu}
            description={t.publish.dianpingGuide.chooseXhs}
            logoSrc="/publish/xiaohongshu.png"
            disabled={busy}
            onClick={() => void handleXiaohongshu()}
          />
          <PlatformCard
            name={t.publish.platforms.dianping}
            description={t.publish.dianpingGuide.chooseDp}
            logoSrc="/publish/dianping.png"
            disabled={busy}
            onClick={handleDianping}
          />
        </section>

        {dianpingFallback && !dianpingOpen ? (
          <a
            href={DIANPING_SHOP_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            {t.publish.dianpingShopFallback}
          </a>
        ) : null}

        {status === "shared" && fileShare ? (
          <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <ul className="space-y-2.5 text-sm">
              <li className="text-foreground">{t.publish.stepPhotos}</li>
              <li className="text-foreground">{t.publish.stepShare}</li>
            </ul>
          </section>
        ) : null}

        {status === "shared" ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {t.publish.statusAppMissing}
          </p>
        ) : null}
        {filesPartial && status === "shared" ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {t.publish.statusFilesPartial}
          </p>
        ) : null}

        {mobile && (status === "fallback" || status === "files-partial") ? (
          <Button className="w-full" variant="outline" disabled={busy} onClick={() => void openRednote()}>
            {t.publish.openXiaohongshu}
          </Button>
        ) : null}
      </div>
      {dianpingOpen ? (
        <DianpingCopyModal
          pkg={pkg}
          busy={busy}
          showFallback={dianpingFallback}
          onClose={() => setDianpingOpen(false)}
          onPublish={() => void publishDianping()}
        />
      ) : null}
    </div>
  );
}

function PlatformCard({
  name,
  description,
  logoSrc,
  disabled,
  onClick,
}: {
  name: string;
  description: string;
  logoSrc: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-3xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-all duration-200 disabled:opacity-40 active:scale-[0.98]"
    >
      <img src={logoSrc} alt="" className="size-14 shrink-0 rounded-[14px]" />
      <span className="min-w-0">
        <span className="block text-base font-semibold text-foreground">{name}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
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
