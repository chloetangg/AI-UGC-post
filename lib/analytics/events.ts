import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/mongodb";
import { persistAnalyticsEvent } from "@/lib/analytics/persist";
import {
  ANALYTICS_CAMPAIGN,
  ANALYTICS_COLLECTION,
  type AnalyticsEventDocument,
  type AnalyticsEventType,
  type RecordAnalyticsInput,
} from "@/lib/analytics/types";

const ONCE_PER_SESSION: AnalyticsEventType[] = [
  "form_submit",
  "generation_complete",
  "xhs_publish_click",
  "xhs_copy_content",
  "dianping_copy_content",
];

let indexesReady: Promise<void> | null = null;

function isDuplicateKey(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export function analyticsEventId(
  eventType: AnalyticsEventType,
  sessionId: string,
  explicit?: string,
  platform?: string,
) {
  const custom = explicit?.trim();
  if (custom) return custom.slice(0, 120);
  if (eventType === "publish_click") {
    const key = platform?.trim() || "unknown";
    return `publish_click:${key}:${sessionId}`;
  }
  if (eventType === "publish_platform_selected") {
    const key = platform?.trim() || "unknown";
    return `publish_platform_selected:${key}:${sessionId}`;
  }
  if (ONCE_PER_SESSION.includes(eventType)) return `${eventType}:${sessionId}`;
  return `${eventType}:${sessionId}:${Date.now()}:${randomUUID()}`;
}

export async function ensureAnalyticsIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      const collection = db.collection(ANALYTICS_COLLECTION);
      await Promise.all([
        collection.createIndex({ eventId: 1 }, { unique: true, name: "eventId_unique" }),
        collection.createIndex({ eventType: 1, timestamp: 1 }, { name: "eventType_timestamp" }),
        collection.createIndex({ sessionId: 1, eventType: 1 }, { name: "sessionId_eventType" }),
        collection.createIndex({ qrCodeId: 1, timestamp: 1 }, { name: "qrCodeId_timestamp" }),
        collection.createIndex({ timestamp: 1 }, { name: "timestamp" }),
      ]);
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

export async function recordAnalyticsEvent(input: RecordAnalyticsInput) {
  const sessionId = input.sessionId.trim();
  if (!sessionId) return { recorded: false, duplicate: false };
  try {
    await ensureAnalyticsIndexes();
    const timestamp = new Date();
    const document: AnalyticsEventDocument = {
      eventId: analyticsEventId(
        input.eventType,
        sessionId,
        input.eventId,
        input.metadata?.platform,
      ),
      eventType: input.eventType,
      sessionId,
      qrCodeId: input.qrCodeId?.trim() || "",
      campaign: input.campaign?.trim() || ANALYTICS_CAMPAIGN,
      brandId: "baan-ying",
      timestamp,
      metadata: input.metadata ?? {},
    };
    const db = await getDb();
    await db.collection(ANALYTICS_COLLECTION).insertOne(document);
    void persistAnalyticsEvent({
      brandId: document.brandId,
      eventType: document.eventType,
      timestamp,
      document,
    });
    return { recorded: true, duplicate: false };
  } catch (error) {
    if (isDuplicateKey(error)) return { recorded: false, duplicate: true };
    console.error("[analytics] record failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[analytics]", detail);
    return { recorded: false, duplicate: false };
  }
}
