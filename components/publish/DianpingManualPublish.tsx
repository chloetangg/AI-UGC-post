"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import {
  copyPublishText,
  formatDianpingPasteText,
  isMobileDevice,
  type RednotePublishPackage,
} from "@/lib/rednote-publish";

export function DianpingManualPublish({
  pkg,
  onBack,
}: {
  pkg: RednotePublishPackage;
  onBack: () => void;
}) {
  const t = useT();
  const g = t.publish.dianpingGuide;
  const mobile = useSyncExternalStore(emptySubscribe, isMobileDevice, () => false);
  const pasteText = useMemo(() => formatDianpingPasteText(pkg), [pkg]);

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  async function copyAll() {
    const ok = await copyPublishText(pasteText);
    setCopyFailed(!ok);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      return;
    }
    setShowCaption(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 pb-4">
        <button
          type="button"
          className="text-sm font-semibold text-muted-foreground"
          onClick={onBack}
        >
          ← {g.back}
        </button>

        <div className="space-y-2">
          <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground">
            {g.title}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{g.subtitle}</p>
        </div>

        {!mobile ? (
          <div className="rounded-3xl bg-accent/70 p-4 text-sm leading-relaxed text-accent-foreground">
            {g.desktopHint}
          </div>
        ) : null}

        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {g.stepsTitle}
          </h2>
          <ol className="space-y-4">
            <GuideStep title={g.step1Title} />
            <GuideStep title={g.step4Title} body={g.step4Path} />
          </ol>
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {g.captionLabel}
            </h2>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
              onClick={() => setShowCaption((open) => !open)}
            >
              {showCaption ? g.hideCaption : g.viewCaption}
              {showCaption ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
          {showCaption || copyFailed ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground select-text">
              {pasteText}
            </p>
          ) : null}
          {copyFailed ? (
            <p className="text-sm text-destructive">{t.publish.statusCopyFailed}</p>
          ) : null}
          <Button className="w-full" size="lg" onClick={() => void copyAll()}>
            {copied ? g.copied : g.copyAll}
          </Button>
        </section>

        <div className="rounded-3xl bg-primary/10 p-4 text-sm font-semibold leading-relaxed text-foreground">
          {g.warning}
        </div>
      </div>
    </div>
  );
}

function GuideStep({ title, body }: { title: string; body?: string }) {
  return (
    <li className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
    </li>
  );
}

function emptySubscribe() {
  return () => undefined;
}
