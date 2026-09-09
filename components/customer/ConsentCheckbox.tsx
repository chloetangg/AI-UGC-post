"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/providers/language-provider";

export function ConsentCheckbox({
  checked,
  error,
  onCheckedChange,
  privacyHref,
}: {
  checked: boolean;
  error?: string;
  onCheckedChange: (checked: boolean) => void;
  privacyHref: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor="consent" className="text-sm font-normal leading-relaxed text-foreground">
          <ConsentCopy href={privacyHref} />
        </Label>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ConsentCopy({ href }: { href: string }) {
  const t = useT();
  const [before, after = ""] = t.customer.consent.split("{privacyPolicy}");
  return (
    <>
      {before}
      <Link
        href={href}
        className="font-semibold text-primary underline-offset-2 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {t.customer.privacyPolicy}
      </Link>
      {after}
    </>
  );
}
