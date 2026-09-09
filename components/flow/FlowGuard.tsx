"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { campaignPath, type FlowStep } from "@/lib/flow";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";

export function FlowGuard({ step }: { step: FlowStep }) {
  const router = useRouter();
  const { campaignId, hydrated, canAccess, firstBlockedStep } = useCampaignFlow();

  useEffect(() => {
    if (!hydrated) return;
    if (canAccess(step)) return;
    const blocked = firstBlockedStep(step);
    router.replace(campaignPath(campaignId, blocked ?? "customer"));
  }, [campaignId, canAccess, firstBlockedStep, hydrated, router, step]);

  return null;
}
