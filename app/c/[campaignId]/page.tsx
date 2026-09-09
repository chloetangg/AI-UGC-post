import { redirect } from "next/navigation";

export default async function CampaignLandingPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(`/c/${campaignId}/customer`);
}
