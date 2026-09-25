"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { GeneratingState } from "@/components/generation/GeneratingState";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { campaignPath } from "@/lib/flow";

export default function GeneratingPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { hydrated, canAccess, generatePost } = useCampaignFlow();
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"post" | "cover">("post");

  useEffect(() => {
    if (!hydrated || !canAccess("generating")) return;
    let cancelled = false;
    setPhase("post");

    void (async () => {
      try {
        await generatePost((next) => {
          if (!cancelled) setPhase(next);
        });
        if (!cancelled) {
          router.replace(campaignPath(campaignId, "result"));
        }
      } catch (caught) {
        if (!cancelled) {
          setError(true);
          setErrorMessage(caught instanceof Error ? caught.message : "");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, campaignId, canAccess, generatePost, hydrated, router]);

  return (
    <>
      <FlowGuard step="generating" />
      <GeneratingState
        key={attempt}
        error={error}
        errorMessage={errorMessage}
        phase={phase}
        onRetry={() => {
          setError(false);
          setErrorMessage("");
          setPhase("post");
          setAttempt((current) => current + 1);
        }}
      />
    </>
  );
}
