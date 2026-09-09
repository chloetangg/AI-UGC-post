"use client";

import { useParams, useRouter } from "next/navigation";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { PageTitle } from "@/components/campaign/PageTitle";
import { FlowGuard } from "@/components/flow/FlowGuard";
import { useCampaignFlow } from "@/components/providers/campaign-flow-provider";
import { useT } from "@/components/providers/language-provider";
import { campaignPath } from "@/lib/flow";

export default function CustomerPage() {
  const router = useRouter();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { customer, setCustomer, saveYouPage } = useCampaignFlow();
  const t = useT();

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
        onContinue={async () => {
          await saveYouPage();
          router.push(campaignPath(campaignId, "experience"));
        }}
      />
    </>
  );
}
