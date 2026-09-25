import { recordExperienceScan } from "@/lib/analytics/you-scan";
import { ExperiencePageClient } from "./experience-page-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ExperiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.qr;
  await recordExperienceScan(Array.isArray(raw) ? raw[0] : raw);
  return <ExperiencePageClient />;
}
