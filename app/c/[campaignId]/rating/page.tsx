import { headers } from "next/headers";
import { recordExperienceScan } from "@/lib/analytics/you-scan";
import { parseStarRating } from "@/lib/analytics/types";
import { getDeploymentConfig } from "@/lib/deployment/config";
import { NEW_RATING_PARAM } from "@/lib/entry-rating";
import { RatingPageClient } from "./rating-page-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RatingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const newRound = firstParam(params[NEW_RATING_PARAM]) === "1";
  const draw = !newRound && firstParam(params.draw) === "1";
  const stars = newRound ? null : parseStarRating(firstParam(params.stars));
  const isFullPageLoad = (await headers()).get("sec-fetch-dest") === "document";
  if (!draw && stars == null) {
    await recordExperienceScan(firstParam(params.qr), "rating-page");
  }
  const deployment = getDeploymentConfig();
  return (
    <RatingPageClient
      newRound={newRound}
      initialDraw={draw && !isFullPageLoad}
      brandName={deployment.brandName}
      storeName={deployment.branchName}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
