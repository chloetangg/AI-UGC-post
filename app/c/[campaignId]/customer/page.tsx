import { recordYouPageScan } from "@/lib/analytics/you-scan";
import { YouPageClient } from "./you-page-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function YouPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.qr;
  await recordYouPageScan(Array.isArray(raw) ? raw[0] : raw);
  return <YouPageClient />;
}
