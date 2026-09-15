"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { copyPublishText, formatDianpingPasteText, type RednotePublishPackage } from "@/lib/rednote-publish";
import { DIANPING_SHOP_WEB_URL } from "@/lib/publish/dianping-shop";

export function DianpingCopyModal({
  pkg,
  busy,
  showFallback,
  onClose,
  onPublish,
}: {
  pkg: RednotePublishPackage;
  busy?: boolean;
  showFallback?: boolean;
  onClose: () => void;
  onPublish: () => void;
}) {
  const t = useT();
  const g = t.publish.dianpingGuide;
  const pasteText = useMemo(() => formatDianpingPasteText(pkg), [pkg]);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyBody() {
    const ok = await copyPublishText(pasteText);
    setCopyFailed(!ok);
    if (!ok) return;
    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label={g.back} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dianping-copy-title"
        className="relative z-10 w-full max-w-[400px] rounded-3xl border border-border bg-card p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 id="dianping-copy-title" className="text-lg font-semibold text-foreground">
              {g.copyBodyTitle}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{g.copyFirst}</p>
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
            {copied ? g.copied : g.copyAll}
          </Button>
          <Button className="w-full" size="lg" disabled={!copied || busy} onClick={onPublish}>
            {t.publish.publishAction.dianping}
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
