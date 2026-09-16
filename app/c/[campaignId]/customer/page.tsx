"use client";

import { startTransition, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { PageTitle } from "@/components/campaign/PageTitle";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { ChoiceChip } from "@/components/preferences/ChoiceChip";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { useT } from "@/components/providers/language-provider";
import { sanitizeQrCodeId } from "@/lib/analytics/cookie";
import { trackAnalyticsEvent } from "@/lib/analytics/track-client";
import { campaignPath } from "@/lib/flow";
import {
  CUSTOMER_TYPES,
  VISIT_FREQUENCIES,
  emptyProductFeedback,
  withDefaultBranch,
  type VisitFrequency,
} from "@/types/content";

export default function CustomerPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { customer, setCustomer, productFeedback, setProductFeedback, saveYouPage } = useCampaignFlow();
  const t = useT();
  const feedback = withDefaultBranch({ ...emptyProductFeedback, ...productFeedback });
  const visitFrequency = VISIT_FREQUENCIES.includes(feedback.visitFrequency as VisitFrequency)
    ? feedback.visitFrequency
    : "";
  const identityReady = Boolean(feedback.customerType && visitFrequency);

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
        extraValid={identityReady}
        extraError={t.experience.requiredError}
        onContinue={() => {
          void saveYouPage();
          startTransition(() => {
            router.push(campaignPath(campaignId, "experience"));
          });
        }}
      >
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q2Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q2Description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_TYPES.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.customerTypes[option]}
                selected={feedback.customerType === option}
                onClick={() => setProductFeedback({ ...feedback, customerType: option })}
              />
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t.experience.q3Title}</h2>
            <p className="text-sm text-muted-foreground">{t.experience.q3Description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {VISIT_FREQUENCIES.map((option) => (
              <ChoiceChip
                key={option}
                label={t.options.visitFrequencies[option]}
                selected={visitFrequency === option}
                onClick={() => setProductFeedback({ ...feedback, visitFrequency: option })}
              />
            ))}
          </div>
        </section>
      </CustomerForm>
    </>
  );
}
