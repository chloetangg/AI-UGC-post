import { getDb } from "@/lib/mongodb";

export const SUBMISSIONS_COLLECTION = "submissions";

export type SavedCustomerInfo = {
  ageRange: string;
  gender: string;
  location: string;
  countryIso2: string;
  countryCode: string;
};

export type SubmissionUpsert = {
  submissionId: string;
  campaignId: string;
  customer?: SavedCustomerInfo;
  customerType?: string;
  visitFrequency?: string;
  mealExpenseThb?: number | null;
  origin?: string;
  diningExperienceNote?: string;
};

export async function upsertSubmission(input: SubmissionUpsert) {
  const db = await getDb();
  const now = new Date();
  const set: Record<string, unknown> = {
    submissionId: input.submissionId,
    campaignId: input.campaignId,
    updatedAt: now,
  };
  if (input.customer) {
    set.customer = input.customer;
  }
  if (input.customerType !== undefined) {
    set.customerType = input.customerType.trim();
  }
  if (input.visitFrequency !== undefined) {
    set.visitFrequency = input.visitFrequency.trim();
  }
  if (input.mealExpenseThb !== undefined) {
    set.mealExpenseThb = input.mealExpenseThb;
    set.mealExpenseCurrency = "THB";
  }
  if (input.origin !== undefined) {
    set.origin = input.origin.trim();
  }
  if (input.diningExperienceNote !== undefined) {
    set.diningExperienceNote = input.diningExperienceNote.trim();
  }

  await db.collection(SUBMISSIONS_COLLECTION).updateOne(
    { submissionId: input.submissionId },
    {
      $set: set,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}
