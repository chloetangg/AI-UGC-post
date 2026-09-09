"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { PublishPreview } from "@/components/publish/PublishPreview";
import { Button } from "@/components/ui/button";
import { campaignPath } from "@/lib/flow";
import { buildFinalSlides } from "@/lib/cover/post-layout";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";

export default function PublishPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { hydrated, canAccess, draft, generated, cover, photos } = useCampaignFlow();
  const t = useT();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!hydrated || !canAccess("publish")) return;
    if (!draft) {
      router.replace(campaignPath(campaignId, "result"));
    }
  }, [campaignId, canAccess, draft, hydrated, router]);

  const title = generated?.titles[draft?.selectedTitleIndex ?? 0] ?? "";

  return (
    <>
      <FlowGuard step="publish" />
      <PageTitle
        title={t.publish.title}
        subtitle={t.publish.subtitle}
      />
      {draft ? (
        <PublishPreview title={title} draft={draft} slides={buildFinalSlides(photos, cover)} />
      ) : null}

      <div className="mt-6 rounded-3xl bg-accent/70 p-4 text-sm leading-relaxed text-accent-foreground">
        {t.publish.photoNote}
      </div>

      <div className="sticky bottom-0 mt-auto -mx-5 bg-gradient-to-t from-background via-background to-transparent px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          className="w-full"
          onClick={() => {
            setOpened(true);
            window.setTimeout(() => setOpened(false), 2200);
          }}
        >
          {t.publish.openXiaohongshu}
        </Button>
        {opened ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {interpolate(t.publish.demoOnly, { campaignId })}
          </p>
        ) : null}
      </div>
    </>
  );
}
