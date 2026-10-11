import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CampaignFlowProvider } from "@/components/providers/campaign-flow-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { CampaignShell } from "@/components/campaign/CampaignShell";
import { getDeploymentConfig, isCurrentDeploymentRef } from "@/lib/deployment/config";
import { newRatingPath } from "@/lib/entry-rating";

export default async function CampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const deployment = getDeploymentConfig();
  if (!isCurrentDeploymentRef(campaignId)) {
    redirect(newRatingPath(deployment.campaignId));
  }

  return (
    <LanguageProvider>
      <CampaignFlowProvider campaignId={campaignId}>
        <CampaignShell campaignId={campaignId}>{children}</CampaignShell>
      </CampaignFlowProvider>
    </LanguageProvider>
  );
}
