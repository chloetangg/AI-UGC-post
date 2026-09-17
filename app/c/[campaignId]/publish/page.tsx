"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { PublishAssistant } from "@/components/publish/PublishAssistant";
import { campaignPath } from "@/lib/flow";
import { buildFinalSlides } from "@/lib/cover/post-layout";
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

  const slides = useMemo(() => buildFinalSlides(photos, cover), [cover, photos]);

  const pkg = useMemo(() => {
    if (!draft || !generated) return null;
    const bodyPhotos = slides
      .filter((slide) => slide.kind === "photo")
      .map((slide) => {
        const original = photos.find((photo) => photo.id === slide.id);
        return {
          previewUrl: slide.src,
          name: original?.name,
        };
      });
    return prepareRednotePublishPackage({
      titles: generated.titles,
      selectedTitleIndex: draft.selectedTitleIndex,
      caption: draft.caption,
      hashtags: draft.hashtags,
      coverImageUrl: cover?.generatedCoverImageUrl ?? null,
      selectedPhotoIndex: cover?.selectedPhotoIndex ?? generated.selectedPhotoIndex ?? 0,
      coverPhotoIndexes: [],
      photos: bodyPhotos,
    });
  }, [cover, draft, generated, photos, slides]);

  return (
    <>
      <FlowGuard step="publish" />
      {pkg ? <PublishAssistant pkg={pkg} slides={slides} /> : null}
    </>
  );
}
