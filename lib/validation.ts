import { combineInternationalPhone, findCountryByIso2 } from "@/lib/country-calling-codes";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidLocalPhoneNumber(value: string) {
  return /^\d+$/.test(value) && value.length >= 6;
}

export function isValidPhone(value: string) {
  const compact = value.trim();
  return /^\+\d{8,}$/.test(compact.replace(/[\s()-]/g, ""));
}

export function phoneFieldsFromParts(countryIso2: string, countryCode: string, phoneNumber: string) {
  const country = findCountryByIso2(countryIso2, countryCode);
  const fullPhoneNumber = combineInternationalPhone(country.dial, phoneNumber);
  return {
    countryIso2: country.iso2,
    countryCode: country.dial,
    phoneNumber,
    fullPhoneNumber,
    phone: fullPhoneNumber,
  };
}

export type FieldErrors<T extends string> = Partial<Record<T, string>>;
