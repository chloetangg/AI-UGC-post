"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { campaignPath } from "@/lib/flow";

export function YouPageClient() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qr = params.get("qr")?.trim() || "";
    const experience = campaignPath(campaignId, "experience");
    router.replace(qr ? `${experience}?qr=${encodeURIComponent(qr)}` : experience);
  }, [campaignId, router]);

  return null;
}
