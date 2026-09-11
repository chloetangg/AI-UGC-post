import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/mongodb";
import type { GenerationCostReport } from "@/lib/openai-usage";
import type { SavedCustomerInfo } from "@/lib/submissions";

export const GENERATIONS_COLLECTION = "generations";

export type GenerationDocument = {
  generationId: string;
  createdAt: Date;
  campaignId: string;
  submissionId: string;
  customer: SavedCustomerInfo;
  customerType: string;
  visitFrequency: string;
  mealExpenseThb: number | null;
  titles: [string, string, string];
  caption: string;
  hashtags: [string, string, string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  aiUsage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
};

export type InsertGenerationInput = {
  generationId?: string;
  campaignId?: string;
  submissionId?: string;
  customer?: Partial<SavedCustomerInfo>;
  customerType?: string;
  visitFrequency?: string;
  mealExpenseThb?: number | null;
  titles: [string, string, string];
  caption: string;
  hashtags: [string, string, string, string, string] | string[];
  coverTitle: string;
  coverSubtitle: string;
  cost: GenerationCostReport;
};

function asTriple(titles: string[]): [string, string, string] {
  return [titles[0] ?? "", titles[1] ?? "", titles[2] ?? ""];
}

function asFive(hashtags: string[]): [string, string, string, string, string] {
  return [
    hashtags[0] ?? "",
    hashtags[1] ?? "",
    hashtags[2] ?? "",
    hashtags[3] ?? "",
    hashtags[4] ?? "",
  ];
}

function mealExpenseThb(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export async function insertGeneration(input: InsertGenerationInput) {
  const db = await getDb();
  const document: GenerationDocument = {
    generationId: input.generationId?.trim() || randomUUID(),
    createdAt: new Date(),
    campaignId: input.campaignId?.trim() || "baan-ying",
    submissionId: input.submissionId?.trim() || "",
    customer: {
      ageRange: input.customer?.ageRange?.trim() || "",
      gender: input.customer?.gender?.trim() || "",
      location: input.customer?.location?.trim() || "",
      countryIso2: input.customer?.countryIso2?.trim() || "",
      countryCode: input.customer?.countryCode?.trim() || "",
    },
    customerType: input.customerType?.trim() || "",
    visitFrequency: input.visitFrequency?.trim() || "",
    mealExpenseThb: mealExpenseThb(input.mealExpenseThb),
    titles: asTriple(input.titles),
    caption: input.caption,
    hashtags: asFive(input.hashtags),
    coverTitle: input.coverTitle.trim(),
    coverSubtitle: input.coverSubtitle.trim(),
    aiUsage: {
      model: input.cost.model || "unknown",
      inputTokens: input.cost.inputTokens,
      outputTokens: input.cost.outputTokens,
      totalTokens: input.cost.totalTokens,
      cost: input.cost.totalCost,
    },
  };

  await db.collection(GENERATIONS_COLLECTION).insertOne(document);
  return document.generationId;
}
