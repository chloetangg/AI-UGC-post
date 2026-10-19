import type { Document } from "mongodb";
import { getDeploymentConfig } from "@/lib/deployment/config";
import { dashboardBranchById } from "@/lib/deployment/databases";
import { getNamedDb } from "@/lib/mongodb";
import { resolveAnalyticsWindow } from "@/lib/analytics/dates";
import { ensureAnalyticsIndexes } from "@/lib/analytics/events";
import {
  ANALYTICS_COLLECTION,
  ANALYTICS_TIMEZONE,
  FORM_SUBMIT_SOURCE,
  type AnalyticsDailyRow,
  type AnalyticsLowRatingRow,
  type AnalyticsQrRow,
  type AnalyticsReport,
  type AnalyticsSummary,
} from "@/lib/analytics/types";

const LOW_RATING_ROWS = 100;

/**
 * Each dashboard number is one plain filter, so a figure means exactly one event definition.
 * Form Submission is only the 3–5 star Continue; older `form_submit` rows (one per /api/generate request)
 * are counted apart and never added in. Generate counts every click; Generation Complete every success.
 */
export const METRIC_FILTERS = {
  qrScans: { eventType: "qr_scan" },
  ratingSubmissions: { eventType: "rating_submitted" },
  lowRatings: { eventType: "rating_submitted", "metadata.band": "rating_low" },
  formSubmissions: { eventType: "form_submit", "metadata.source": FORM_SUBMIT_SOURCE },
  legacyFormSubmissions: { eventType: "form_submit", "metadata.source": { $ne: FORM_SUBMIT_SOURCE } },
  generateActions: { eventType: "generate" },
  generations: { eventType: "generation_complete" },
  xhsPublishClicks: { eventType: "xhs_publish_click" },
  dianpingPublishClicks: { eventType: "publish_dianping_click" },
} as const satisfies Record<Exclude<keyof AnalyticsSummary, "uniqueVisitors">, Document>;

type CountedMetric = keyof typeof METRIC_FILTERS;
const DAILY_METRICS = [
  "qrScans",
  "ratingSubmissions",
  "formSubmissions",
  "generateActions",
  "generations",
  "xhsPublishClicks",
  "dianpingPublishClicks",
] as const satisfies readonly CountedMetric[];

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseLowRatingStars(value: string | null | undefined): 1 | 2 | null {
  const text = value?.trim();
  return text === "1" ? 1 : text === "2" ? 2 : null;
}

export async function queryAnalyticsReport(input: {
  range?: string;
  startDate?: string;
  endDate?: string;
  qrCodeId?: string;
  branchId?: string;
  lowRatingStars?: string;
}): Promise<AnalyticsReport> {
  const branch = dashboardBranchById(input.branchId?.trim() || getDeploymentConfig().branchId);
  if (!branch) throw new Error("Unknown branch");
  const window = resolveAnalyticsWindow(input);
  const qrCodeId = input.qrCodeId?.trim() || "";
  const lowRatingStars = parseLowRatingStars(input.lowRatingStars);
  const match: Record<string, unknown> = {};
  if (window.from || window.to) {
    match.timestamp = {
      ...(window.from ? { $gte: window.from } : {}),
      ...(window.to ? { $lte: window.to } : {}),
    };
  }
  if (qrCodeId) match.qrCodeId = qrCodeId;

  const day = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: ANALYTICS_TIMEZONE } };
  const facets: Record<string, Document[]> = {
    uniqueVisitors: [{ $group: { _id: "$sessionId" } }, { $count: "count" }],
    byQrCode: [
      { $match: METRIC_FILTERS.qrScans },
      { $group: { _id: "$qrCodeId", scans: { $sum: 1 } } },
      { $sort: { scans: -1 } },
    ],
    lowRatingFeedback: [
      {
        $match: {
          ...METRIC_FILTERS.lowRatings,
          ...(lowRatingStars ? { "metadata.rating": String(lowRatingStars) } : {}),
        },
      },
      { $sort: { timestamp: -1 } },
      { $limit: LOW_RATING_ROWS },
    ],
  };
  for (const [key, filter] of Object.entries(METRIC_FILTERS)) {
    facets[key] = [{ $match: filter }, { $count: "count" }];
  }
  for (const key of DAILY_METRICS) {
    facets[`daily_${key}`] = [
      { $match: METRIC_FILTERS[key] },
      { $group: { _id: day, count: { $sum: 1 } } },
    ];
  }

  const db = await getNamedDb(branch.dbName);
  await ensureAnalyticsIndexes(db);
  const [facet = {}] = await db
    .collection(ANALYTICS_COLLECTION)
    .aggregate<Record<string, Document[]>>([{ $match: match }, { $facet: facets }])
    .toArray();

  const counted = (key: string) => asCount(facet[key]?.[0]?.count);
  const summary = {
    uniqueVisitors: counted("uniqueVisitors"),
    ...Object.fromEntries(Object.keys(METRIC_FILTERS).map((key) => [key, counted(key)])),
  } as AnalyticsSummary;

  const days = new Map<string, AnalyticsDailyRow>();
  for (const key of DAILY_METRICS) {
    for (const row of facet[`daily_${key}`] ?? []) {
      const date = String(row._id ?? "");
      if (!date) continue;
      const entry =
        days.get(date) ??
        ({ date, ...Object.fromEntries(DAILY_METRICS.map((metric) => [metric, 0])) } as AnalyticsDailyRow);
      entry[key] = asCount(row.count);
      days.set(date, entry);
    }
  }
  const daily = [...days.values()].sort((left, right) => left.date.localeCompare(right.date));

  const byQrCode: AnalyticsQrRow[] = (facet.byQrCode ?? [])
    .filter((row) => row._id)
    .map((row) => ({ qrCodeId: String(row._id), scans: asCount(row.scans) }));

  const lowRatingFeedback: AnalyticsLowRatingRow[] = (facet.lowRatingFeedback ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const timestamp = row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp ?? "");
    return {
      reviewId: typeof metadata.reviewId === "string" ? metadata.reviewId : "",
      rating: Number(metadata.rating) || 0,
      feedback: typeof metadata.feedback === "string" ? metadata.feedback : "",
      timestamp,
    };
  });

  return {
    range: window.range,
    startDate: window.startDate,
    endDate: window.endDate,
    timezone: ANALYTICS_TIMEZONE,
    branchId: branch.id,
    branchName: branch.name,
    summary,
    conversion: {
      qrToRating: percent(summary.ratingSubmissions, summary.qrScans),
      qrToForm: percent(summary.formSubmissions, summary.qrScans),
      formToGenerate: percent(summary.generateActions, summary.formSubmissions),
      generateToComplete: percent(summary.generations, summary.generateActions),
      formToGeneration: percent(summary.generations, summary.formSubmissions),
      generationToXhs: percent(summary.xhsPublishClicks, summary.generations),
      qrToXhs: percent(summary.xhsPublishClicks, summary.qrScans),
    },
    daily,
    byQrCode,
    lowRatingStars,
    lowRatingFeedback,
  };
}
