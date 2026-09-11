"use client";

import { startTransition, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { PageTitle } from "@/components/campaign/PageTitle";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { useT } from "@/components/providers/language-provider";
import { sanitizeQrCodeId } from "@/lib/analytics/cookie";
import { trackAnalyticsEvent } from "@/lib/analytics/track-client";
import { campaignPath } from "@/lib/flow";

export default function CustomerPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { customer, setCustomer, saveYouPage } = useCampaignFlow();
  const t = useT();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("qr");
    if (!raw) return;
    const qrCodeId = sanitizeQrCodeId(raw);
    trackAnalyticsEvent({
      eventType: "qr_scan",
      qrCodeId,
      metadata: { source: "customer-entry" },
    });
    params.delete("qr");
    const next = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
  }, []);

  return (
    <>
      <FlowGuard step="customer" />
      <PageTitle
        title={t.customer.title}
        subtitle={t.customer.subtitle}
      />
      <CustomerForm
        value={customer}
        onChange={setCustomer}
        onContinue={() => {
          void saveYouPage();
          startTransition(() => {
            router.push(campaignPath(campaignId, "experience"));
          });
        }}
      />
    </>
  );
}
