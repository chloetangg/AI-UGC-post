"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { campaignPath } from "@/lib/flow";

export function YouPageClient() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("qr")) {
      params.delete("qr");
      const next = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
    router.replace(campaignPath(campaignId, "experience"));
  }, [campaignId, router]);

  return null;
}
