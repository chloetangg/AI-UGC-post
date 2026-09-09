"use client";

import { startTransition, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { StickyAction } from "@/components/campaign/StickyAction";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { campaignPath } from "@/lib/flow";
import { useT } from "@/components/providers/language-provider";

export default function UploadPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { photos, addPhotos, removePhoto } = useCampaignFlow();
  const t = useT();
  const [touched, setTouched] = useState(false);

  function generate() {
    setTouched(true);
    if (photos.length === 0) return;
    startTransition(() => {
      router.push(campaignPath(campaignId, "generating"));
    });
  }

  return (
    <>
      <FlowGuard step="upload" />
      <PageTitle
        title={t.upload.title}
        subtitle={t.upload.subtitle}
      />
      <PhotoUploader photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
      {touched && photos.length === 0 ? (
        <p className="mt-4 text-sm text-destructive">{t.upload.requiredError}</p>
      ) : null}
      <StickyAction onClick={generate}>
        {t.upload.generate}
      </StickyAction>
    </>
  );
}
