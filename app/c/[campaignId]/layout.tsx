import type { ReactNode } from "react";
import { CampaignFlowProvider } from "@/components/providers/campaign-flow-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { CampaignShell } from "@/components/campaign/CampaignShell";

export default async function CampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  return (
    <LanguageProvider>
      <CampaignFlowProvider campaignId={campaignId}>
        <CampaignShell campaignId={campaignId}>{children}</CampaignShell>
      </CampaignFlowProvider>
    </LanguageProvider>
  );
}
