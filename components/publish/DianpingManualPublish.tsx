"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import {
  copyPublishText,
  formatDianpingPasteText,
  formatXiaohongshuPasteText,
  type RednotePublishPackage,
} from "@/lib/rednote-publish";
import { DIANPING_SHOP_WEB_URL } from "@/lib/publish/dianping-shop";

function PublishCopyModal({
  title,
  description,
  pasteText,
  copyLabel,
  copiedLabel,
  publishLabel,
  publishPendingLabel,
  busy,
  showFallback,
  onClose,
  onCopied,
  onPublish,
}: {
  title: string;
  description: string;
  pasteText: string;
  copyLabel: string;
  copiedLabel: string;
  publishLabel: string;
  publishPendingLabel: string;
  busy?: boolean;
  showFallback?: boolean;
  onClose: () => void;
  onCopied?: () => void;
  onPublish: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyBody() {
    const ok = await copyPublishText(pasteText);
    setCopyFailed(!ok);
    if (!ok) return;
    setCopied(true);
    onCopied?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label={t.publish.dianpingGuide.back} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-copy-title"
        className="relative z-10 w-full max-w-[400px] rounded-3xl border border-border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 id="publish-copy-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t.publish.closeSelector}
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-muted/60 p-3 text-[15px] leading-relaxed text-foreground select-text">
          {pasteText}
        </p>

        {copyFailed ? (
          <p className="mb-3 text-sm text-destructive">{t.publish.statusCopyFailed}</p>
        ) : null}

        <div className="space-y-2.5">
          <Button className="w-full" size="lg" variant={copied ? "outline" : "default"} onClick={() => void copyBody()}>
            {copied ? copiedLabel : copyLabel}
          </Button>
          <Button className="w-full" size="lg" disabled={!copied || busy} onClick={onPublish}>
            {copied ? publishLabel : publishPendingLabel}
          </Button>
        </div>

        {showFallback ? (
          <a
            href={DIANPING_SHOP_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            {t.publish.dianpingShopFallback}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function DianpingCopyModal({
  pkg,
  busy,
  showFallback,
  onClose,
  onCopied,
  onPublish,
}: {
  pkg: RednotePublishPackage;
  busy?: boolean;
  showFallback?: boolean;
  onClose: () => void;
  onCopied?: () => void;
  onPublish: () => void;
}) {
  const t = useT();
  const g = t.publish.dianpingGuide;
  const pasteText = useMemo(() => formatDianpingPasteText(pkg), [pkg]);

  return (
    <PublishCopyModal
      title={g.title}
      description={g.copyFirst}
      pasteText={pasteText}
      copyLabel={g.copyAll}
      copiedLabel={g.copied}
      publishLabel={t.publish.publishAction.dianping}
      publishPendingLabel={g.copyNeedFirst}
      busy={busy}
      showFallback={showFallback}
      onClose={onClose}
      onCopied={onCopied}
      onPublish={onPublish}
    />
  );
}

export function XiaohongshuCopyModal({
  pkg,
  busy,
  onClose,
  onCopied,
  onPublish,
}: {
  pkg: RednotePublishPackage;
  busy?: boolean;
  onClose: () => void;
  onCopied?: () => void;
  onPublish: () => void;
}) {
  const t = useT();
  const g = t.publish.xhsGuide;
  const pasteText = useMemo(
    () =>
      formatXiaohongshuPasteText({
        title: pkg.title,
        caption: pkg.caption,
        hashtags: pkg.hashtags,
        titles: pkg.titles,
      }),
    [pkg.caption, pkg.hashtags, pkg.title, pkg.titles],
  );

  return (
    <PublishCopyModal
      title={g.title}
      description={g.copyFirst}
      pasteText={pasteText}
      copyLabel={g.copyAll}
      copiedLabel={g.copied}
      publishLabel={t.publish.publishAction.xiaohongshu}
      publishPendingLabel={g.copyNeedFirst}
      busy={busy}
      onClose={onClose}
      onCopied={onCopied}
      onPublish={onPublish}
    />
  );
}
