"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { OriginCityField } from "@/components/customer/OriginCityField";
import { StickyAction } from "@/components/campaign/StickyAction";
import { Label } from "@/components/ui/label";
import { MenuSelect } from "@/components/ui/menu-select";
import { isKnownOriginCity } from "@/lib/world-cities";
import { type FieldErrors } from "@/lib/validation";
import { AGE_RANGES, GENDERS, type CustomerInfo } from "@/types/customer";
import { useT } from "@/components/providers/language-provider";
import type { Dictionary } from "@/lib/i18n";

type CustomerFields = keyof CustomerInfo;

export function CustomerForm({
  value,
  onChange,
  onContinue,
  extraValid = true,
  extraError,
  children,
}: {
  value: CustomerInfo;
  onChange: (value: CustomerInfo) => void;
  onContinue: () => void;
  extraValid?: boolean;
  extraError?: string;
  children?: ReactNode;
}) {
  const t = useT();
  const [touched, setTouched] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const errors = useMemo(() => validateCustomer(value, t), [value, t]);
  const show = (field: CustomerFields) => (touched ? errors[field] : undefined);
  const hasErrors = Object.keys(errors).length > 0 || !extraValid;

  function update<K extends CustomerFields>(field: K, next: CustomerInfo[K]) {
    onChange({ ...value, [field]: next });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    setLeaving(true);
    onContinue();
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit} noValidate>
      <div className="space-y-4 pb-28">
        <Field label={t.customer.ageRange} htmlFor="ageRange" required error={show("ageRange")} optionalLabel={t.common.optional}>
          <MenuSelect
            id="ageRange"
            aria-label={t.customer.ageRange}
            value={value.ageRange}
            placeholder={t.customer.ageRangePlaceholder}
            invalid={Boolean(show("ageRange"))}
            options={AGE_RANGES.map((range) => ({ value: range, label: range }))}
            onChange={(next) => update("ageRange", next as CustomerInfo["ageRange"])}
          />
        </Field>

        <Field label={t.customer.gender} htmlFor="gender" required error={show("gender")} optionalLabel={t.common.optional}>
          <MenuSelect
            id="gender"
            aria-label={t.customer.gender}
            value={value.gender}
            placeholder={t.customer.genderPlaceholder}
            invalid={Boolean(show("gender"))}
            options={GENDERS.map((gender) => ({
              value: gender.value,
              label: t.customer.genders[gender.value],
            }))}
            onChange={(next) => update("gender", next as CustomerInfo["gender"])}
          />
        </Field>

        <Field label={t.customer.location} htmlFor="location" required error={show("location")} optionalLabel={t.common.optional}>
          <OriginCityField
            value={value.location}
            invalid={Boolean(show("location"))}
            placeholder={t.customer.locationPlaceholder}
            searchPlaceholder={t.customer.locationSearchPlaceholder}
            noMatches={t.customer.locationNoMatches}
            onChange={(location) => update("location", location)}
          />
        </Field>

        {children ? <div className="space-y-7 pt-3">{children}</div> : null}

        {touched && hasErrors ? (
          <p className="text-sm text-destructive">
            {Object.keys(errors).length > 0 ? t.customer.formError : extraError}
          </p>
        ) : null}
      </div>

      <StickyAction type="submit" disabled={leaving}>{t.common.continue}</StickyAction>
    </form>
  );
}

function validateCustomer(value: CustomerInfo, t: Dictionary) {
  const errors: FieldErrors<CustomerFields> = {};
  if (!value.ageRange) errors.ageRange = t.customer.errors.ageRange;
  if (!value.gender) errors.gender = t.customer.errors.gender;
  if (!isKnownOriginCity(value.location)) errors.location = t.customer.errors.location;
  return errors;
}

function Field({
  label,
  htmlFor,
  required,
  optional,
  optionalLabel,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  optionalLabel: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-1 text-base font-semibold leading-snug">
        {label}
        {required ? <span className="text-primary">*</span> : null}
        {optional ? (
          <span className="font-normal text-muted-foreground">{optionalLabel}</span>
        ) : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
