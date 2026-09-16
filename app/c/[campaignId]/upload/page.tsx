"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { campaignPath } from "@/lib/flow";

export default function UploadPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();

  useEffect(() => {
    router.replace(campaignPath(campaignId, "experience"));
  }, [campaignId, router]);

  return null;
}
