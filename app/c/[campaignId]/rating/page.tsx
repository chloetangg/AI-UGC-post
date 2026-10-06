import { headers } from "next/headers";
import { recordExperienceScan } from "@/lib/analytics/you-scan";
import { RatingPageClient } from "./rating-page-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RatingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const draw = firstParam(params.draw) === "1";
  const isFullPageLoad = (await headers()).get("sec-fetch-dest") === "document";
  if (!draw) {
    await recordExperienceScan(firstParam(params.qr), "rating-page");
  }
  return <RatingPageClient initialDraw={draw && !isFullPageLoad} />;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
