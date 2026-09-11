import { NextResponse } from "next/server";
import { upsertSubmission, type SavedCustomerInfo } from "@/lib/submissions";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCustomer(value: unknown): SavedCustomerInfo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const customer = value as Record<string, unknown>;
  const ageRange = asString(customer.ageRange);
  const gender = asString(customer.gender);
  const location = asString(customer.location);
  if (!ageRange && !gender && !location) return undefined;
  return {
    ageRange,
    gender,
    location,
    countryIso2: asString(customer.countryIso2),
    countryCode: asString(customer.countryCode),
  };
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return asString(value);
}

function parseMealExpense(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const submissionId = asString(body.submissionId);
    const campaignId = asString(body.campaignId);
    if (!submissionId || !campaignId) {
      return NextResponse.json({ error: "Missing submissionId or campaignId" }, { status: 400 });
    }

    await upsertSubmission({
      submissionId,
      campaignId,
      customer: parseCustomer(body.customer),
      customerType: parseOptionalString(body.customerType),
      visitFrequency: parseOptionalString(body.visitFrequency),
      mealExpenseThb: parseMealExpense(body.mealExpenseThb),
    });

    return NextResponse.json({ ok: true, submissionId });
  } catch (error) {
    console.error("[submissions] save failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[submissions]", detail);
    return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
  }
}
