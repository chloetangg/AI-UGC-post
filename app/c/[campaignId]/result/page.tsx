"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { CaptionEditor } from "@/components/result/CaptionEditor";
import { CoverEditor } from "@/components/result/CoverEditor";
import { HashtagEditor } from "@/components/result/HashtagEditor";
import { TemplatePicker } from "@/components/result/TemplatePicker";
import { TitleSelector } from "@/components/result/TitleSelector";
import { Button } from "@/components/ui/button";
import { campaignPath } from "@/lib/flow";
import { buildFinalSlides } from "@/lib/cover/post-layout";
import { ensureRequiredHashtags, stripAllHashtagsFromCaption } from "@/lib/hashtags";
import { useT } from "@/components/providers/language-provider";
import type { ResultDraft } from "@/types/content";

export default function ResultPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const {
    hydrated,
    canAccess,
    draft,
    generated,
    cover,
    coverComposing,
    photos,
    updateDraft,
    retryCover,
    selectCoverTemplate,
  } = useCampaignFlow();
  const t = useT();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hydrated || !canAccess("result")) return;
    if (!draft) {
      router.replace(campaignPath(campaignId, "generating"));
    }
  }, [campaignId, canAccess, draft, hydrated, router]);

  function patch(partial: Partial<ResultDraft>) {
    if (!draft) return;
    setSaved(false);
    updateDraft({ ...draft, ...partial });
  }

  function saveChanges() {
    if (!draft) return;
    const hashtags = ensureRequiredHashtags(draft.hashtags);
    updateDraft({
      ...draft,
      caption: stripAllHashtagsFromCaption(draft.caption),
      hashtags,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function goToPublish() {
    if (!draft) return;
    const hashtags = ensureRequiredHashtags(draft.hashtags);
    updateDraft({
      ...draft,
      caption: stripAllHashtagsFromCaption(draft.caption),
      hashtags,
    });
    router.push(campaignPath(campaignId, "publish"));
  }

  if (!draft || !generated) {
    return (
      <>
        <FlowGuard step="result" />
        <p className="text-sm text-muted-foreground">{t.result.preparing}</p>
      </>
    );
  }

  return (
    <>
      <FlowGuard step="result" />
      <PageTitle title={t.result.title} />
      <div className="space-y-7 pb-6">
        {cover ? (
          <>
            <CoverEditor
              cover={cover}
              slides={buildFinalSlides(photos, cover)}
              composing={coverComposing}
              onRetry={() => void retryCover()}
            />
            <TemplatePicker
              selectedId={cover.selectedCoverTemplateId}
              disabled={coverComposing}
              onSelect={(templateId) => void selectCoverTemplate(templateId)}
            />
          </>
        ) : null}
        <TitleSelector
          titles={generated.titles}
          selectedIndex={draft.selectedTitleIndex}
          onSelect={(selectedTitleIndex) => patch({ selectedTitleIndex })}
        />
        <CaptionEditor
          value={draft.caption}
          onChange={(caption) => patch({ caption })}
        />
        <HashtagEditor
          value={draft.hashtags}
          onChange={(hashtags) => patch({ hashtags })}
        />
      </div>
      <div className="sticky bottom-0 -mx-5 space-y-2 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(campaignPath(campaignId, "generating"))}
          >
            {t.result.regenerate}
          </Button>
          <Button variant="secondary" onClick={saveChanges}>
            {saved ? t.result.saved : t.result.saveChanges}
          </Button>
        </div>
        <Button className="w-full" onClick={goToPublish}>
          {t.result.goToXiaohongshu}
        </Button>
      </div>
    </>
  );
}
