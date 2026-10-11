import { redirect } from "next/navigation";
import { parseStarRating } from "@/lib/analytics/types";
import { getDeploymentConfig } from "@/lib/deployment/config";
import { RatingReviewClient } from "../rating-page-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RatingReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campaignId } = await params;
  const query = await searchParams;
  const value = Array.isArray(query.stars) ? query.stars[0] : query.stars;
  const rating = parseStarRating(value);
  if (rating == null || rating > 2) {
    redirect(`/c/${campaignId}/rating`);
  }
  const deployment = getDeploymentConfig();
  return <RatingReviewClient rating={rating} brandName={deployment.brandName} storeName={deployment.branchName} />;
}
