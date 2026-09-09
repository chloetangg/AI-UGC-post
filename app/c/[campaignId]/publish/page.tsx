"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { PublishAssistant } from "@/components/publish/PublishAssistant";
import { campaignPath } from "@/lib/flow";
import { buildFinalSlides, isFourPhotoGridCover } from "@/lib/cover/post-layout";
import { prepareRednotePublishPackage } from "@/lib/rednote-publish";

export default function PublishPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { hydrated, canAccess, draft, generated, cover, photos } = useCampaignFlow();

  useEffect(() => {
    if (!hydrated || !canAccess("publish")) return;
    if (!draft) {
      router.replace(campaignPath(campaignId, "result"));
    }
  }, [campaignId, canAccess, draft, hydrated, router]);

  const pkg = useMemo(() => {
    if (!draft || !generated) return null;
    return prepareRednotePublishPackage({
      titles: generated.titles,
      selectedTitleIndex: draft.selectedTitleIndex,
      caption: draft.caption,
      hashtags: draft.hashtags,
      coverImageUrl: cover?.generatedCoverImageUrl ?? null,
      selectedPhotoIndex: cover?.selectedPhotoIndex ?? generated.selectedPhotoIndex ?? 0,
      coverPhotoIndexes: isFourPhotoGridCover(
        photos.length,
        cover?.selectedCoverTemplateId ?? generated.selectedTemplateId ?? "",
      )
        ? []
        : [cover?.selectedPhotoIndex ?? generated.selectedPhotoIndex ?? 0],
      photos: photos.map((photo) => ({ previewUrl: photo.previewUrl, name: photo.name })),
    });
  }, [cover, draft, generated, photos]);

  const slides = useMemo(() => buildFinalSlides(photos, cover), [cover, photos]);

  return (
    <>
      <FlowGuard step="publish" />
      {pkg ? <PublishAssistant pkg={pkg} slides={slides} /> : null}
    </>
  );
}
