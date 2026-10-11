import { redirect } from "next/navigation";
import { newRatingPath } from "@/lib/entry-rating";

export default async function CampaignLandingPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(newRatingPath(campaignId));
}
