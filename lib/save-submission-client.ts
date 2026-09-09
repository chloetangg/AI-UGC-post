import type { CustomerInfo } from "@/types/customer";

export async function saveSubmissionToServer(input: {
  submissionId: string;
  campaignId: string;
  customer?: Pick<CustomerInfo, "ageRange" | "gender" | "location" | "countryIso2" | "countryCode">;
  mealExpenseThb?: number | null;
}) {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submissionId: input.submissionId,
      campaignId: input.campaignId,
      customer: input.customer
        ? {
            ageRange: input.customer.ageRange,
            gender: input.customer.gender,
            location: input.customer.location,
            countryIso2: input.customer.countryIso2,
            countryCode: input.customer.countryCode,
          }
        : undefined,
      mealExpenseThb: input.mealExpenseThb,
    }),
    keepalive: true,
  });
  if (!response.ok) {
    throw new Error("Could not save submission");
  }
}
