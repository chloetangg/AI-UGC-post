import { getDb } from "@/lib/mongodb";
import { resolveAnalyticsWindow } from "@/lib/analytics/dates";
import { ensureAnalyticsIndexes } from "@/lib/analytics/events";
import {
  ANALYTICS_COLLECTION,
  ANALYTICS_TIMEZONE,
  type AnalyticsDailyRow,
  type AnalyticsEventType,
  type AnalyticsQrRow,
  type AnalyticsReport,
} from "@/lib/analytics/types";

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function queryAnalyticsReport(input: {
  range?: string;
  startDate?: string;
  endDate?: string;
  qrCodeId?: string;
}): Promise<AnalyticsReport> {
  const window = resolveAnalyticsWindow(input);
  const qrCodeId = input.qrCodeId?.trim() || "";
  const match: Record<string, unknown> = {};
  if (window.from || window.to) {
    match.timestamp = {
      ...(window.from ? { $gte: window.from } : {}),
      ...(window.to ? { $lte: window.to } : {}),
    };
  }
  if (qrCodeId) match.qrCodeId = qrCodeId;

  await ensureAnalyticsIndexes();
  const db = await getDb();
  const [facet] = await db
    .collection(ANALYTICS_COLLECTION)
    .aggregate<{
      counts?: Array<{ _id: AnalyticsEventType; count: number }>;
      uniqueVisitors?: Array<{ count: number }>;
      rednoteClicks?: Array<{ count: number }>;
      dianpingClicks?: Array<{ count: number }>;
      daily?: Array<{
        _id: string;
        qrScans: number;
        formSubmissions: number;
        generations: number;
        xhsPublishClicks: number;
        dianpingPublishClicks: number;
      }>;
      byQrCode?: Array<{ _id: string; scans: number }>;
    }>([
      { $match: match },
      {
        $facet: {
          counts: [{ $group: { _id: "$eventType", count: { $sum: 1 } } }],
          uniqueVisitors: [
            { $group: { _id: "$sessionId" } },
            { $count: "count" },
          ],
          rednoteClicks: [
            {
              $match: {
                $or: [
                  { eventType: "xhs_publish_click" },
                  { eventType: "publish_click", "metadata.platform": "rednote" },
                  { eventType: "publish_click", "metadata.platform": "xiaohongshu" },
                ],
              },
            },
            { $count: "count" },
          ],
          dianpingClicks: [
            {
              $match: {
                $or: [
                  { eventType: "publish_dianping_click" },
                  { eventType: "publish_click", "metadata.platform": "dianping" },
                ],
              },
            },
            { $count: "count" },
          ],
          daily: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$timestamp",
                    timezone: ANALYTICS_TIMEZONE,
                  },
                },
                qrScans: {
                  $sum: { $cond: [{ $eq: ["$eventType", "qr_scan"] }, 1, 0] },
                },
                formSubmissions: {
                  $sum: { $cond: [{ $eq: ["$eventType", "form_submit"] }, 1, 0] },
                },
                generations: {
                  $sum: { $cond: [{ $eq: ["$eventType", "generation_complete"] }, 1, 0] },
                },
                xhsPublishClicks: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$eventType", "xhs_publish_click"] },
                          {
                            $and: [
                              { $eq: ["$eventType", "publish_click"] },
                              { $in: ["$metadata.platform", ["rednote", "xiaohongshu"]] },
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                dianpingPublishClicks: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$eventType", "publish_dianping_click"] },
                          {
                            $and: [
                              { $eq: ["$eventType", "publish_click"] },
                              { $eq: ["$metadata.platform", "dianping"] },
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byQrCode: [
            { $match: { eventType: "qr_scan" } },
            { $group: { _id: "$qrCodeId", scans: { $sum: 1 } } },
            { $sort: { scans: -1 } },
          ],
        },
      },
    ])
    .toArray();

  const counts = new Map((facet?.counts ?? []).map((row) => [row._id, asCount(row.count)]));
  const summary = {
    qrScans: counts.get("qr_scan") ?? 0,
    uniqueVisitors: asCount(facet?.uniqueVisitors?.[0]?.count),
    formSubmissions: counts.get("form_submit") ?? 0,
    generations: counts.get("generation_complete") ?? 0,
    xhsPublishClicks: asCount(facet?.rednoteClicks?.[0]?.count),
    dianpingPublishClicks: asCount(facet?.dianpingClicks?.[0]?.count),
  };

  const daily: AnalyticsDailyRow[] = (facet?.daily ?? []).map((row) => ({
    date: row._id,
    qrScans: asCount(row.qrScans),
    formSubmissions: asCount(row.formSubmissions),
    generations: asCount(row.generations),
    xhsPublishClicks: asCount(row.xhsPublishClicks),
    dianpingPublishClicks: asCount(row.dianpingPublishClicks),
  }));

  const byQrCode: AnalyticsQrRow[] = (facet?.byQrCode ?? [])
    .filter((row) => row._id)
    .map((row) => ({ qrCodeId: row._id, scans: asCount(row.scans) }));

  return {
    range: window.range,
    startDate: window.startDate,
    endDate: window.endDate,
    timezone: ANALYTICS_TIMEZONE,
    summary,
    conversion: {
      qrToForm: percent(summary.formSubmissions, summary.qrScans),
      formToGeneration: percent(summary.generations, summary.formSubmissions),
      generationToXhs: percent(summary.xhsPublishClicks, summary.generations),
      qrToXhs: percent(summary.xhsPublishClicks, summary.qrScans),
    },
    daily,
    byQrCode,
  };
}
