"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";
import {
  collectRednoteDownloads,
  copyPublishText,
  formatRednotePasteText,
  isMobileDevice,
  type RednotePublishPackage,
} from "@/lib/rednote-publish";
import { saveImagesWithoutShare, saveOneImageWithoutShare } from "@/lib/publish/share";

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
  const pasteText = useMemo(() => formatRednotePasteText(pkg), [pkg]);
  const images = useMemo(() => collectRednoteDownloads(pkg), [pkg]);

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveEach, setSaveEach] = useState(false);

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

  async function saveAll() {
    if (saving) return;
    setSaving(true);
    const results = await saveImagesWithoutShare(pkg);
    const failed = results.some((item) => !item.ok);
    if (mobile || failed || results.length > 1) setSaveEach(true);
    setSaving(false);
  }

  async function saveOne(index: number) {
    const item = images[index];
    if (!item || saving) return;
    setSaving(true);
    const ok = await saveOneImageWithoutShare(item);
    if (!ok) setSaveEach(true);
    setSaving(false);
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
            <GuideStep title={g.step1Title} body={g.step1Body} />
            <GuideStep title={g.step2Title} body={`${g.step2Body}\n${g.step2Order}`} />
            <GuideStep title={g.step4Title} body={`${g.step4Path}\n${g.step4Body}`} />
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

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {g.imagesLabel}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{g.step2Order}</p>
          <div className="grid grid-cols-3 gap-2">
            {images.map((item, index) => {
              const photoIndex = images.slice(0, index + 1).filter((image) => image.kind === "photo").length;
              const label =
                item.kind === "cover" ? g.coverLabel : interpolate(g.photoLabel, { index: photoIndex });
              return (
                <figure key={item.key} className="space-y-1.5">
                  <img
                    src={item.url}
                    alt={label}
                    className="aspect-square w-full rounded-2xl object-cover"
                  />
                  <figcaption className="text-center text-[11px] leading-tight text-muted-foreground">
                    {label}
                  </figcaption>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void saveOne(index)}
                  >
                    {g.saveOne}
                  </Button>
                </figure>
              );
            })}
          </div>
          {saveEach ? (
            <p className="text-sm font-semibold text-foreground">{g.saveEach}</p>
          ) : null}
          {saveEach && mobile ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{t.publish.longPressHint}</p>
          ) : null}
          <Button className="w-full" size="lg" variant="outline" disabled={saving} onClick={() => void saveAll()}>
            {g.saveAll}
          </Button>
        </section>

        <div className="rounded-3xl bg-primary/10 p-4 text-sm font-semibold leading-relaxed text-foreground">
          {g.warning}
        </div>
      </div>
    </div>
  );
}

function GuideStep({ title, body }: { title: string; body: string }) {
  return (
    <li className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

function emptySubscribe() {
  return () => undefined;
}
