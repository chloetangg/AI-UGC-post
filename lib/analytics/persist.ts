import { getDb } from "@/lib/mongodb";
import { ANALYTICS_TIMEZONE } from "@/lib/analytics/types";
import { ymdInTimeZone } from "@/lib/analytics/dates";

const DAILY_COLLECTION = "analytics_daily";
const MONTHLY_COLLECTION = "monthly_archives";

const EVENT_FIELDS: Record<string, string> = {
  qr_scan: "qrScans",
  form_submit: "formSubmissions",
  generation_complete: "generations",
  xhs_publish_click: "xhsPublishClicks",
};

function persistCounterField(eventType: string, document: unknown) {
  if (eventType === "publish_click") {
    const platform = (document as { metadata?: { platform?: string } })?.metadata?.platform;
    if (platform === "rednote" || platform === "xiaohongshu") return "xhsPublishClicks";
    if (platform === "dianping") return "dianpingPublishClicks";
    return "";
  }
  return EVENT_FIELDS[eventType] ?? "";
}

function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key === "_id" ? "id" : key] = jsonSafe(nested);
    }
    return out;
  }
  return value;
}

function monthKey(date: Date) {
  return ymdInTimeZone(date, ANALYTICS_TIMEZONE).slice(0, 7);
}

async function upsertMonthlyItem(
  brandId: string,
  month: string,
  arrayField: "generations" | "analyticsEvents",
  idField: string,
  id: string,
  document: unknown,
) {
  if (!id) return;
  const db = await getDb();
  const replaced = await db.collection(MONTHLY_COLLECTION).updateOne(
    { brandId, month, [`${arrayField}.${idField}`]: id },
    { $set: { [`${arrayField}.$`]: document, updatedAt: new Date(), slug: brandId } },
  );
  if (replaced.matchedCount) return;
  await db.collection(MONTHLY_COLLECTION).updateOne(
    { brandId, month },
    {
      $push: { [arrayField]: document },
      $set: { updatedAt: new Date(), slug: brandId },
      $setOnInsert: {
        brandId,
        month,
        ...(arrayField === "generations" ? { analyticsEvents: [] } : { generations: [] }),
      },
    },
    { upsert: true },
  );
}

export async function persistAnalyticsEvent(input: {
  brandId?: string;
  eventType: string;
  timestamp?: Date;
  document: unknown;
}) {
  try {
    const timestamp = input.timestamp ?? new Date();
    const brandId = input.brandId?.trim() || "baan-ying";
    const date = ymdInTimeZone(timestamp, ANALYTICS_TIMEZONE);
    const field = persistCounterField(input.eventType, input.document);
    const db = await getDb();
    if (field) {
      await db.collection(DAILY_COLLECTION).updateOne(
        { brandId, date },
        {
          $inc: { [field]: 1 },
          $set: { updatedAt: new Date() },
          $setOnInsert: { brandId, date },
        },
        { upsert: true },
      );
    }
    const safe = jsonSafe(input.document) as { eventId?: string };
    await upsertMonthlyItem(brandId, monthKey(timestamp), "analyticsEvents", "eventId", safe.eventId || "", safe);
  } catch (error) {
    console.error("[analytics] persist event failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[analytics]", detail);
  }
}

export async function persistGeneration(input: {
  brandId?: string;
  createdAt?: Date;
  document: unknown;
}) {
  try {
    const createdAt = input.createdAt ?? new Date();
    const brandId = input.brandId?.trim() || "baan-ying";
    const date = ymdInTimeZone(createdAt, ANALYTICS_TIMEZONE);
    const usage = (input.document as { aiUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; cost?: number } })
      .aiUsage;
    const db = await getDb();
    await db.collection(DAILY_COLLECTION).updateOne(
      { brandId, date },
      {
        $inc: {
          generationDocs: 1,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
          cost: usage?.cost ?? 0,
        },
        $set: { updatedAt: new Date() },
        $setOnInsert: { brandId, date },
      },
      { upsert: true },
    );
    const safe = jsonSafe(input.document) as { generationId?: string };
    await upsertMonthlyItem(brandId, monthKey(createdAt), "generations", "generationId", safe.generationId || "", safe);
  } catch (error) {
    console.error("[generations] persist archive failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[generations]", detail);
  }
}
