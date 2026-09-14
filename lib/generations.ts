import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/mongodb";
import { persistGeneration } from "@/lib/analytics/persist";
import type { GenerationCostReport } from "@/lib/openai-usage";
import type { SavedCustomerInfo } from "@/lib/submissions";

export const GENERATIONS_COLLECTION = "generations";

export type GenerationDocument = {
  generationId: string;
  createdAt: Date;
  campaignId: string;
  brandId: string;
  submissionId: string;
  sessionId?: string;
  branch?: string;
  kspId?: string;
  storylineId?: string;
  contentAngleId?: string;
  status: "success" | "failed";
  durationMs?: number;
  customer: SavedCustomerInfo;
  customerType: string;
  visitFrequency: string;
  mealExpenseThb: number | null;
  titles: [string, string, string];
  caption: string;
  hashtags: [string, string, string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  enjoyMost?: string[];
  recommendedDishes?: string[];
  recommendedDishOther?: string;
  recommendTo?: string[];
  diningExperienceNote?: string;
  searchKeyword?: string;
  aiUsage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  businessMetrics?: {
    revenueModel: string;
    revenueRate: number | null;
    estimatedRevenue: number;
  };
};

export type InsertGenerationInput = {
  generationId?: string;
  campaignId?: string;
  brandId?: string;
  submissionId?: string;
  sessionId?: string;
  branch?: string;
  kspId?: string;
  storylineId?: string;
  contentAngleId?: string;
  durationMs?: number;
  customer?: Partial<SavedCustomerInfo>;
  customerType?: string;
  visitFrequency?: string;
  mealExpenseThb?: number | null;
  titles: [string, string, string];
  caption: string;
  hashtags: [string, string, string, string, string] | string[];
  coverTitle: string;
  coverSubtitle: string;
  enjoyMost?: string[];
  recommendedDishes?: string[];
  recommendedDishOther?: string;
  recommendTo?: string[];
  diningExperienceNote?: string;
  searchKeyword?: string;
  cost: GenerationCostReport;
};

function asList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

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
    brandId: input.brandId?.trim() || "baan-ying",
    submissionId: input.submissionId?.trim() || "",
    sessionId: input.sessionId?.trim() || "",
    branch: input.branch?.trim() || "",
    kspId: input.kspId?.trim() || "",
    storylineId: input.storylineId?.trim() || "",
    contentAngleId: input.contentAngleId?.trim() || "",
    status: "success",
    durationMs: input.durationMs,
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
    enjoyMost: asList(input.enjoyMost),
    recommendedDishes: asList(input.recommendedDishes),
    recommendedDishOther: input.recommendedDishOther?.trim() || "",
    recommendTo: asList(input.recommendTo),
    diningExperienceNote: input.diningExperienceNote?.trim() || "",
    searchKeyword: input.searchKeyword?.trim() || "",
    aiUsage: {
      model: input.cost.model || "unknown",
      inputTokens: input.cost.inputTokens,
      outputTokens: input.cost.outputTokens,
      totalTokens: input.cost.totalTokens,
      cost: input.cost.totalCost,
    },
  };

  await db.collection(GENERATIONS_COLLECTION).insertOne(document);
  void persistGeneration({
    brandId: document.brandId,
    createdAt: document.createdAt,
    document,
  });
  return document.generationId;
}
