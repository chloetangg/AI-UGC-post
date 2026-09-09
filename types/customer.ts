export const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export type Gender = (typeof GENDERS)[number]["value"] | "";

export type CustomerInfo = {
  name: string;
  email: string;
  countryIso2: string;
  countryCode: string;
  phoneNumber: string;
  fullPhoneNumber: string;
  phone: string;
  ageRange: AgeRange | "";
  gender: Gender;
  location: string;
  customAnswer: string;
  consent: boolean;
};

export const emptyCustomerInfo: CustomerInfo = {
  name: "",
  email: "",
  countryIso2: "TH",
  countryCode: "+66",
  phoneNumber: "",
  fullPhoneNumber: "",
  phone: "",
  ageRange: "",
  gender: "",
  location: "",
  customAnswer: "",
  consent: false,
};
