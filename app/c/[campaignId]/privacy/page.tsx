"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageTitle } from "@/components/campaign/PageTitle";
import { useT } from "@/components/providers/language-provider";
import { campaignPath } from "@/lib/flow";

export default function PrivacyPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const t = useT();
  const email = t.privacy.contactEmail;

  return (
    <div className="pb-8">
      <PageTitle title={t.privacy.title} subtitle={t.privacy.subtitle} />
      <div className="space-y-6">
        <PrivacySection title={t.privacy.collectTitle}>
          <p>{t.privacy.collectBody}</p>
        </PrivacySection>

        <PrivacySection title={t.privacy.whyTitle}>
          <p>{t.privacy.whyIntro}</p>
          <BulletList items={t.privacy.whyItems} />
          <p>{t.privacy.whyMarketing}</p>
        </PrivacySection>

        <PrivacySection title={t.privacy.processTitle}>
          <BulletList items={t.privacy.processItems} />
        </PrivacySection>

        <PrivacySection title={t.privacy.whereTitle}>
          <p>{t.privacy.whereBody}</p>
        </PrivacySection>

        <PrivacySection title={t.privacy.rightsTitle}>
          <p>
            <EmailCopy template={t.privacy.rightsBody} email={email} />
          </p>
        </PrivacySection>

        <PrivacySection title={t.privacy.eligibilityTitle}>
          <p>{t.privacy.eligibilityBody}</p>
        </PrivacySection>

        <PrivacySection title={t.privacy.updatesTitle}>
          <p>{t.privacy.updatesBody}</p>
        </PrivacySection>
      </div>
      <Link
        href={campaignPath(campaignId, "customer")}
        className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        {t.privacy.back}
      </Link>
    </div>
  );
}

function PrivacySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function EmailCopy({ template, email }: { template: string; email: string }) {
  const [before, after = ""] = template.split("{email}");
  return (
    <>
      {before}
      <a href={`mailto:${email}`} className="font-medium text-primary underline-offset-2 hover:underline">
        {email}
      </a>
      {after}
    </>
  );
}
