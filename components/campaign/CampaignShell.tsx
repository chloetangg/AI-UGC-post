"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { campaignPath, NEXT_FLOW_STEP, PROGRESS_STEPS, progressIndexForStep, type FlowStep } from "@/lib/flow";
import { getCampaign } from "@/lib/mock/campaign";
import { cn } from "@/lib/utils";
import { CampaignHeader } from "@/components/campaign/CampaignHeader";
import { LanguageSwitch } from "@/components/campaign/LanguageSwitch";
import { useT } from "@/components/providers/language-provider";

const STEP_FROM_PATH: Record<string, FlowStep> = {
  customer: "customer",
  experience: "experience",
  preferences: "experience",
  upload: "upload",
  generating: "generating",
  result: "result",
  publish: "publish",
};

const BACK_STEP: Partial<Record<FlowStep, FlowStep>> = {
  experience: "customer",
  upload: "experience",
  result: "upload",
  publish: "result",
};

export function CampaignShell({
  campaignId,
  children,
}: {
  campaignId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const campaign = getCampaign(campaignId);
  const segment = pathname.split("/").filter(Boolean)[2] ?? "";
  const currentStep = STEP_FROM_PATH[segment] ?? "landing";
  const isLanding = currentStep === "landing";
  const isGenerating = currentStep === "generating";
  const isPrivacy = segment === "privacy";
  const showProgress = !isLanding && !isGenerating && !isPrivacy;
  const backStep = BACK_STEP[currentStep];

  useEffect(() => {
    const next = NEXT_FLOW_STEP[currentStep];
    if (!next) return;
    router.prefetch(campaignPath(campaignId, next));
  }, [campaignId, currentStep, router]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-1 flex-col px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {isLanding || isPrivacy ? (
          <div className="mb-2 flex justify-end">
            <LanguageSwitch />
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-3">
            {backStep ? (
              <Link
                href={campaignPath(campaignId, backStep)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm ring-1 ring-border/70"
                aria-label={t.common.goBack}
              >
                <ArrowLeft className="size-4" />
              </Link>
            ) : null}
            <div className="min-w-0 flex-1">
              <CampaignHeader campaign={campaign} compact />
            </div>
            <LanguageSwitch />
          </div>
        )}

        {showProgress && <StepProgress current={currentStep} />}
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function StepProgress({ current }: { current: FlowStep }) {
  const t = useT();
  const labels = {
    rate: t.nav.rate,
    post: t.nav.post,
    share: t.nav.share,
  } as const;
  const visualIndex = progressIndexForStep(current);

  return (
    <ol className="mb-6 flex items-center justify-between gap-1">
      {PROGRESS_STEPS.map((step, index) => {
        const done = visualIndex > index;
        const active = visualIndex === index;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                done || active ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {labels[step.key]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
