import { headers } from "next/headers";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { newAnalyticsSessionId, sanitizeQrCodeId } from "@/lib/analytics/cookie";
import { readAnalyticsSession } from "@/lib/analytics/session";
import { ANALYTICS_CAMPAIGN } from "@/lib/analytics/types";

function headerValue(store: Headers, name: string) {
  return store.get(name) ?? store.get(name.toLowerCase()) ?? "";
}

function isPrefetchRequest(store: Headers) {
  if (headerValue(store, "Next-Router-Prefetch") === "1") return true;
  if (headerValue(store, "Next-Router-Segment-Prefetch")) return true;
  const purpose = `${headerValue(store, "Purpose")} ${headerValue(store, "Sec-Purpose")}`.toLowerCase();
  return purpose.includes("prefetch");
}

export async function recordExperienceScan(qrFromQuery?: string) {
  try {
    const store = await headers();
    if (isPrefetchRequest(store)) return;
    const session = await readAnalyticsSession();
    const sessionId = session.sessionId || newAnalyticsSessionId();
    if (!sessionId) return;
    const result = await recordAnalyticsEvent({
      eventType: "qr_scan",
      sessionId,
      qrCodeId: sanitizeQrCodeId(qrFromQuery || session.qrCodeId),
      campaign: ANALYTICS_CAMPAIGN,
      metadata: { source: "experience-page" },
    });
    if (!result.recorded && !result.duplicate) {
      console.error("[analytics] experience page qr_scan was not written to MongoDB");
    }
  } catch (error) {
    console.error("[analytics] experience page qr_scan failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[analytics]", detail);
  }
}
